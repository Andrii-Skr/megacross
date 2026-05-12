import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/scanwords/fill/regenerate-template/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq, readJson } from "./_utils";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/scanwords/fill/regenerate-template", () => {
  beforeEach(() => {
    resetMocks();
    setAuthed({ id: "17", role: "ADMIN" });
    vi.clearAllMocks();
  });

  it("loads review draft, overlays it, proxies regenerate upstream, and removes target template rows", async () => {
    prisma.scanwordFillReviewDraft.findUnique.mockResolvedValue({
      data: {
        version: 2,
        rows: [
          {
            templateKey: "tpl-1",
            slotId: 1,
            word: "дом",
            definition: "Дом",
            wordId: "500",
            opredId: "600",
          },
          {
            templateKey: "tpl-2",
            slotId: 2,
            word: "лиса",
            definition: "Лиса",
            wordId: "501",
            opredId: "601",
          },
        ],
      },
      expiresAt: null,
    });

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/fill/123/review")) {
        return jsonResponse({
          version: 1,
          issue: { issueId: "1", editionId: 1, editionCode: "E1", issueLabel: "42" },
          options: { style: "corel", writeCrw: false, usageStats: true },
          templates: [
            {
              key: "tpl-1",
              name: "8",
              sourceName: "8.fsh",
              order: 0,
              path: "sample/8.fsh",
              language: "ru",
              langId: 1,
              grid: { rows: 1, cols: 1, data: ["*"], marker: "000", codes: [[1]] },
              slots: [
                {
                  slotId: 1,
                  r: 0,
                  c: 0,
                  dir: "right",
                  len: 3,
                  cells: [[0, 0]],
                  word: "КОТ",
                  wordId: "10",
                  opredId: null,
                  definition: "Кот",
                  definitionOptions: [{ opredId: null, text: "Кот", difficulty: null }],
                  isPhotoDefinition: false,
                  intersections: [],
                  clueCell: null,
                  startNumber: 1,
                },
              ],
              clueGroups: [],
              startPositions: [],
            },
            {
              key: "tpl-2",
              name: "9",
              sourceName: "9.fsh",
              order: 1,
              path: "sample/9.fsh",
              language: "ru",
              langId: 1,
              grid: { rows: 1, cols: 1, data: ["*"], marker: "000", codes: [[1]] },
              slots: [
                {
                  slotId: 2,
                  r: 0,
                  c: 0,
                  dir: "right",
                  len: 4,
                  cells: [[0, 0]],
                  word: "ЛИСА",
                  wordId: "11",
                  opredId: null,
                  definition: "Лиса",
                  definitionOptions: [{ opredId: null, text: "Лиса", difficulty: null }],
                  isPhotoDefinition: false,
                  intersections: [],
                  clueCell: null,
                  startNumber: 1,
                },
              ],
              clueGroups: [],
              startPositions: [],
            },
          ],
        });
      }
      if (url.endsWith("/api/fill/123/regenerate-template")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body)) as {
          templateKey: string;
          templates: Array<{ key: string; slots: Array<{ slotId: number; word: string; definition: string }> }>;
        };
        expect(body.templateKey).toBe("tpl-1");
        expect(body.templates).toEqual([
          {
            key: "tpl-1",
            slots: [
              {
                slotId: 1,
                word: "ДОМ",
                definition: "Дом",
                wordId: "500",
                opredId: "600",
              },
            ],
          },
          {
            key: "tpl-2",
            slots: [
              {
                slotId: 2,
                word: "ЛИСА",
                definition: "Лиса",
                wordId: "501",
                opredId: "601",
              },
            ],
          },
        ]);
        return jsonResponse({ id: "123", status: "review" });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      makeReq("POST", "http://localhost/api/scanwords/fill/regenerate-template", {
        jobId: "123",
        templateKey: "tpl-1",
      }),
      makeCtx({}),
    );
    const { status, json } = await readJson<{ id: string; status: string }>(res);

    expect(status).toBe(200);
    expect(json).toMatchObject({ id: "123", status: "review" });
    expect(prisma.scanwordFillReviewDraft.update).toHaveBeenCalledWith({
      where: { jobId_userId: { jobId: 123n, userId: 17 } },
      data: {
        data: {
          version: 2,
          rows: [
            {
              templateKey: "tpl-2",
              slotId: 2,
              word: "ЛИСА",
              definition: "Лиса",
              wordId: "501",
              opredId: "601",
            },
          ],
        },
      },
    });
  });
});
