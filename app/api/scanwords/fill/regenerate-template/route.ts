import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Permissions } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { getNumericUserId } from "@/lib/user";
import { buildEditableTemplateStates, mapPersistedRowsByTemplate, normalizePersistedRows } from "@/components/scanwords/workspace/reviewDraftState";
import type { FillReviewPayload } from "@/components/scanwords/workspace/model";
import { apiRoute } from "@/utils/appRoute";

const schema = z.object({
  jobId: z.string().min(1),
  templateKey: z.string().min(1).max(128),
});

type Body = z.infer<typeof schema>;

function errorResponse(status: number, message: string, errorCode: string) {
  return NextResponse.json({ success: false, message, errorCode }, { status });
}

function crossApiBases(): string[] {
  const configured = [process.env.CROSS_API_URL, process.env.NEXT_PUBLIC_CROSS_API_URL]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0)
    .map((value) => value.replace(/\/$/, ""));
  const fallbacks = [
    "http://cross:3001",
    "http://host.docker.internal:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ];
  return [...new Set([...configured, ...fallbacks])];
}

function parseJsonSafe(raw: string): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function extractMessageFromPayload(payload: unknown): string | null {
  const obj = asObject(payload);
  if (!obj) return null;
  const message = typeof obj.message === "string" && obj.message.trim().length > 0 ? obj.message : null;
  if (message) return message;
  const error = typeof obj.error === "string" && obj.error.trim().length > 0 ? obj.error : null;
  return error;
}

function extractErrorCodeFromPayload(payload: unknown): string | null {
  const obj = asObject(payload);
  if (!obj) return null;
  return typeof obj.errorCode === "string" && obj.errorCode.trim().length > 0 ? obj.errorCode : null;
}

function upstreamErrorCodeByStatus(status: number): string {
  switch (status) {
    case 400:
      return "UPSTREAM_BAD_REQUEST";
    case 401:
      return "UPSTREAM_UNAUTHORIZED";
    case 403:
      return "UPSTREAM_FORBIDDEN";
    case 404:
      return "UPSTREAM_NOT_FOUND";
    case 409:
      return "UPSTREAM_CONFLICT";
    case 422:
      return "UPSTREAM_UNPROCESSABLE_ENTITY";
    case 429:
      return "UPSTREAM_RATE_LIMITED";
    default:
      return "UPSTREAM_ERROR";
  }
}

function getUserId(user: { id?: string | number | null } | null): number | null {
  return getNumericUserId(user);
}

function isStorageUnavailableError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2022")
  );
}

function parseReviewPayload(raw: unknown): FillReviewPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Partial<FillReviewPayload>;
  if (payload.version !== 1 || !payload.issue || !Array.isArray(payload.templates)) return null;
  return payload as FillReviewPayload;
}

async function loadDraftRows(jobId: bigint, userId: number): Promise<ReturnType<typeof mapPersistedRowsByTemplate>> {
  try {
    const draft = await prisma.scanwordFillReviewDraft.findUnique({
      where: { jobId_userId: { jobId, userId } },
      select: { data: true, expiresAt: true },
    });
    if (!draft) return new Map();
    if (draft.expiresAt && draft.expiresAt <= new Date()) return new Map();
    const payload =
      typeof draft.data === "string"
        ? parseJsonSafe(draft.data)
        : draft.data;
    const rows = normalizePersistedRows(asObject(payload)?.rows);
    return mapPersistedRowsByTemplate(rows);
  } catch (err) {
    if (isStorageUnavailableError(err)) return new Map();
    throw err;
  }
}

async function deleteTemplateRowsFromDraft(
  jobId: bigint,
  userId: number,
  templateKey: string,
): Promise<void> {
  try {
    const draft = await prisma.scanwordFillReviewDraft.findUnique({
      where: { jobId_userId: { jobId, userId } },
      select: { data: true, expiresAt: true },
    });
    if (!draft) return;
    const payload =
      typeof draft.data === "string"
        ? parseJsonSafe(draft.data)
        : draft.data;
    const rows = normalizePersistedRows(asObject(payload)?.rows).filter((row) => row.templateKey !== templateKey);
    if (!rows.length) {
      await prisma.scanwordFillReviewDraft.deleteMany({
        where: { jobId, userId },
      });
      return;
    }
    await prisma.scanwordFillReviewDraft.update({
      where: { jobId_userId: { jobId, userId } },
      data: {
        data: { version: 2, rows },
      },
    });
  } catch (err) {
    if (isStorageUnavailableError(err)) return;
    throw err;
  }
}

export const POST = apiRoute<Body>(
  async (_req, body, _params, user) => {
    const userId = getUserId(user as { id?: string | number | null } | null);
    if (userId == null) {
      return errorResponse(401, "Unauthorized", "UNAUTHORIZED");
    }

    let jobId: bigint;
    try {
      jobId = BigInt(body.jobId);
    } catch {
      return errorResponse(400, "Invalid jobId", "INVALID_JOB_ID");
    }

    const upstreamTargets = crossApiBases();
    let reviewPayload: FillReviewPayload | null = null;
    let lastReviewNetworkError: unknown = null;

    for (const upstreamBase of upstreamTargets) {
      const reviewUrl = `${upstreamBase}/api/fill/${encodeURIComponent(body.jobId)}/review`;
      try {
        const response = await fetch(reviewUrl, { cache: "no-store" });
        const text = await response.text().catch(() => "");
        const json = parseJsonSafe(text);
        if (!response.ok) {
          if (response.status === 404) continue;
          const message = (extractMessageFromPayload(json) ?? text) || `HTTP ${response.status}`;
          return errorResponse(response.status, message, upstreamErrorCodeByStatus(response.status));
        }
        reviewPayload = parseReviewPayload(json);
        if (reviewPayload) break;
      } catch (error) {
        lastReviewNetworkError = error;
      }
    }

    if (!reviewPayload) {
      const message =
        lastReviewNetworkError instanceof Error ? lastReviewNetworkError.message : "Review data not found";
      return errorResponse(502, message, "UPSTREAM_UNAVAILABLE");
    }

    const draftRowsByTemplate = await loadDraftRows(jobId, userId);
    const editableTemplates = buildEditableTemplateStates(reviewPayload.templates, draftRowsByTemplate).map((template) => ({
      key: template.key,
      slots: template.slots.map((slot) => ({
        slotId: slot.slotId,
        word: slot.word,
        definition: slot.definition,
        wordId: slot.wordId,
        opredId: slot.opredId,
      })),
    }));

    let upstream: Response | null = null;
    let lastNetworkError: unknown = null;
    for (const upstreamBase of upstreamTargets) {
      const upstreamUrl = `${upstreamBase}/api/fill/${encodeURIComponent(body.jobId)}/regenerate-template`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      try {
        upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateKey: body.templateKey,
            templates: editableTemplates,
          }),
          cache: "no-store",
          signal: controller.signal,
        });
        break;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return errorResponse(504, "Regenerate request timed out", "UPSTREAM_TIMEOUT");
        }
        lastNetworkError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!upstream) {
      const message = lastNetworkError instanceof Error ? lastNetworkError.message : "Failed to reach fill service";
      return errorResponse(502, message, "UPSTREAM_UNAVAILABLE");
    }

    const text = await upstream.text().catch(() => "");
    const json = parseJsonSafe(text);

    if (!upstream.ok) {
      const status = upstream.status || 502;
      const message = (extractMessageFromPayload(json) ?? text) || `HTTP ${upstream.status}`;
      const errorCode = extractErrorCodeFromPayload(json) ?? upstreamErrorCodeByStatus(status);
      return errorResponse(status, message, errorCode);
    }

    await deleteTemplateRowsFromDraft(jobId, userId, body.templateKey);

    if (json && typeof json === "object") {
      return NextResponse.json(json, { status: upstream.status });
    }

    return NextResponse.json({ success: true });
  },
  {
    schema,
    requireAuth: true,
    permissions: [Permissions.DictionaryWrite],
  },
);
