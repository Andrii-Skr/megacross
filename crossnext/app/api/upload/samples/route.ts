import fs from "node:fs/promises";
import path from "node:path";
import { parseFshBytes, SlotCoverageError, scanSlots, validateSlotCoverage } from "@megacross/cross-format";
import {
  InvalidStorageNameError,
  resolveIssueStorageDirectory,
  sanitizeStorageName as sanitizeName,
} from "@megacross/cross-format/storage-paths";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { hasPermissionAsync, Permissions } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { replaceDirectory } from "@/lib/replaceDirectory";

function error(status: number, message: string, errorCode: string) {
  return NextResponse.json({ success: false, message, errorCode }, { status });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function pickUniqueName(dir: string, rawName: string, used: Set<string>): Promise<string> {
  const ext = path.extname(rawName);
  const baseRaw = ext ? rawName.slice(0, -ext.length) : rawName;
  const base = baseRaw.length > 0 ? baseRaw : "file";
  let candidate = `${base}${ext}`;
  let counter = 2;
  while (used.has(candidate) || (await fileExists(path.join(dir, candidate)))) {
    candidate = `${base}_${counter}${ext}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

async function getUploadBlocker(issueId: bigint): Promise<"running" | "review" | null> {
  try {
    const active = await prisma.scanwordFillJob.findFirst({
      where: {
        issueId,
        status: {
          in: ["queued", "running"],
        },
      },
      select: { id: true },
    });
    if (active) return "running";
    // Old reviews remain in history even after a newer job has finished.
    // Only the current review still depends on the uploaded templates.
    const latest = await prisma.scanwordFillJob.findFirst({
      where: { issueId },
      orderBy: { id: "desc" },
      select: { status: true },
    });
    return latest?.status === "review" ? "review" : null;
  } catch (err: unknown) {
    // Table may not exist in environments where migrations haven't been applied yet.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return null;
    }
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string | null } | null)?.role ?? null;
    const allowed = await hasPermissionAsync(role, Permissions.DictionaryWrite);
    if (!session || !allowed) {
      return error(session ? 403 : 401, "Unauthorized", "UPLOAD_UNAUTHORIZED");
    }

    const form = await req.formData();
    const issueIdRaw = form.get("issueId");
    let issueId: bigint | null = null;
    if (typeof issueIdRaw === "string" && issueIdRaw.trim().length > 0) {
      try {
        issueId = BigInt(issueIdRaw.trim());
      } catch {
        return error(400, "Invalid issueId", "UPLOAD_INVALID_ISSUE_ID");
      }
    }
    const incoming = form.getAll("files");
    const files = incoming.filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return error(400, "No files", "UPLOAD_NO_FILES");
    }

    const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file

    const baseDir = process.env.CROSS_SAMPLES_DIR;
    if (!baseDir) {
      return error(500, "CROSS_SAMPLES_DIR is not configured", "UPLOAD_CONFIG_MISSING");
    }
    // Validate the whole batch before replacing any existing templates.
    const validatedFiles: { name: string; buf: Buffer }[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return error(413, "File too large", "UPLOAD_FILE_TOO_LARGE");
      }
      const buf = Buffer.from(await file.arrayBuffer());
      try {
        const grid = parseFshBytes(buf);
        validateSlotCoverage(grid, scanSlots(grid));
      } catch (err) {
        return NextResponse.json(
          {
            success: false,
            errorCode: err instanceof SlotCoverageError ? "UPLOAD_UNCOVERED_CELLS" : "UPLOAD_INVALID_TEMPLATE",
            message: err instanceof Error ? err.message : "Invalid template",
            fileName: file.name,
            cells:
              err instanceof SlotCoverageError
                ? err.cells.map(([row, col]) => ({ row: row + 1, column: col + 1 }))
                : undefined,
          },
          { status: 400 },
        );
      }
      validatedFiles.push({ name: sanitizeName(file.name || "file"), buf });
    }
    let dest = baseDir;
    if (issueId) {
      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: {
          edition: { select: { code: true } },
          issueNumber: { select: { label: true } },
        },
      });
      if (!issue) {
        return error(404, "Issue not found", "UPLOAD_ISSUE_NOT_FOUND");
      }
      const blocker = await getUploadBlocker(issueId);
      if (blocker === "running") {
        return error(409, "Generation is running for this issue", "UPLOAD_FILL_RUNNING");
      }
      if (blocker === "review") {
        return error(409, "Complete the current review before replacing templates", "UPLOAD_REVIEW_PENDING");
      }
      dest = resolveIssueStorageDirectory(baseDir, issue.edition.code, issue.issueNumber.label);
    }
    const writeFiles = async (directory: string) => {
      const usedNames = new Set<string>();
      const saved: { name: string; size: number }[] = [];
      for (const { name: rawName, buf } of validatedFiles) {
        const name = await pickUniqueName(directory, rawName, usedNames);
        await fs.writeFile(path.join(directory, name), buf);
        saved.push({ name, size: buf.length });
      }
      return saved;
    };
    let saved: { name: string; size: number }[];
    if (issueId) {
      saved = await replaceDirectory(dest, writeFiles);
    } else {
      await fs.mkdir(dest, { recursive: true });
      saved = await writeFiles(dest);
    }

    return NextResponse.json({ ok: true, saved, dest });
  } catch (err) {
    if (err instanceof InvalidStorageNameError)
      return error(400, "Invalid storage name", "UPLOAD_INVALID_STORAGE_NAME");
    console.error("Failed to upload scanword templates", err);
    return error(500, "Internal server error", "UPLOAD_INTERNAL_ERROR");
  }
}
