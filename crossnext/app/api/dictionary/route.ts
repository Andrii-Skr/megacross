import { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildDictionarySearchRegex, filterDictionarySearchRows } from "@/lib/dictionarySearch";
import { isMissingWordImagesRelationError } from "@/lib/scanwordWordImages";
import { apiRoute } from "@/utils/appRoute";

const pageSizeSchema = z.coerce.number().int().min(1);

function error(status: number, message: string, errorCode: string) {
  return NextResponse.json({ success: false, message, errorCode }, { status });
}

const getHandler = async (
  req: NextRequest,
  _body: unknown,
  _params: Record<string, never>,
  _user: Session["user"] | null,
) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const scope = searchParams.get("scope") || "both"; // word|def|both
  const langCode = (searchParams.get("lang") || "ru").toLowerCase();
  const tagNames = Array.from(
    new Set(
      [...searchParams.getAll("tags").map((s) => s.trim()), searchParams.get("tag")?.trim() || ""].filter(Boolean),
    ),
  );
  const excludeTagNames = Array.from(
    new Set(
      [...searchParams.getAll("excludeTags").map((s) => s.trim()), searchParams.get("excludeTag")?.trim() || ""].filter(
        Boolean,
      ),
    ),
  );
  const modeParam = searchParams.get("mode");
  const searchMode: "contains" | "startsWith" | "exact" =
    modeParam === "startsWith" ? "startsWith" : modeParam === "exact" ? "exact" : "contains";
  const lenField = searchParams.get("lenField") as "word" | "def" | "" | null;
  const lenDirRaw = searchParams.get("lenDir");
  const lenDir: "asc" | "desc" | undefined = lenDirRaw === "asc" || lenDirRaw === "desc" ? lenDirRaw : undefined;
  const sortFieldRaw = searchParams.get("sortField");
  const sortField: "word" | undefined = sortFieldRaw === "word" ? "word" : undefined;
  const sortDirRaw = searchParams.get("sortDir");
  const sortDir: "asc" | "desc" | undefined = sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : undefined;
  const defSortDirRaw = searchParams.get("defSortDir");
  const defSortDir: "asc" | "desc" | undefined =
    defSortDirRaw === "asc" || defSortDirRaw === "desc" ? defSortDirRaw : undefined;
  const lenFilterField = searchParams.get("lenFilterField") as "word" | "def" | "" | null;
  const lenMinRaw = searchParams.get("lenMin");
  const lenMaxRaw = searchParams.get("lenMax");
  const lenMin = lenMinRaw && lenMinRaw !== "" ? Number.parseInt(lenMinRaw, 10) : undefined;
  const lenMax = lenMaxRaw && lenMaxRaw !== "" ? Number.parseInt(lenMaxRaw, 10) : undefined;
  const diffRaw = searchParams.get("difficulty");
  const difficulty = diffRaw && diffRaw !== "" ? Number.parseInt(diffRaw, 10) : undefined;
  const diffMinRaw = searchParams.get("difficultyMin");
  const diffMaxRaw = searchParams.get("difficultyMax");
  const difficultyMin = diffMinRaw && diffMinRaw !== "" ? Number.parseInt(diffMinRaw, 10) : undefined;
  const difficultyMax = diffMaxRaw && diffMaxRaw !== "" ? Number.parseInt(diffMaxRaw, 10) : undefined;
  const pageSize = pageSizeSchema.safeParse(searchParams.get("take") ?? 20);
  if (!pageSize.success) return error(400, "Invalid page size", "INVALID_PAGE_SIZE");
  const take = Math.min(pageSize.data, 50);
  const cursorParam = searchParams.get("cursor");
  let cursor: bigint | undefined;
  if (cursorParam) {
    try {
      cursor = BigInt(cursorParam);
    } catch {
      return error(400, "Invalid cursor", "INVALID_CURSOR");
    }
  }
  const now = new Date();
  const textFilter = { contains: q, mode: "insensitive" as const };
  const searchRegex = buildDictionarySearchRegex(q, searchMode);
  const wordSearch = q && (scope === "word" || scope === "both") ? { word_text: textFilter } : undefined;

  const whereLenWord =
    lenFilterField === "word" && (Number.isFinite(lenMin as number) || Number.isFinite(lenMax as number))
      ? {
          length: {
            ...(Number.isFinite(lenMin as number) ? { gte: lenMin as number } : {}),
            ...(Number.isFinite(lenMax as number) ? { lte: lenMax as number } : {}),
          },
        }
      : {};

  // Combine definition-level filters (tag, length, difficulty) so a single definition must satisfy all.
  // Text search is applied separately depending on scope.
  const opredSomeBase: Record<string, unknown> = {
    is_deleted: false,
    language: { is: { code: langCode } },
  };
  if (tagNames.length)
    opredSomeBase.tags = {
      some: {
        tag: {
          OR: tagNames.map((name) => ({
            name: { contains: name, mode: "insensitive" as const },
          })),
        },
      },
    };
  if (excludeTagNames.length) {
    opredSomeBase.NOT = {
      tags: {
        some: {
          tag: {
            OR: excludeTagNames.map((name) => ({
              name: { contains: name, mode: "insensitive" as const },
            })),
          },
        },
      },
    };
  }
  if (Number.isFinite(difficulty as number)) opredSomeBase.difficulty = { equals: difficulty as number };
  else if (Number.isFinite(difficultyMin as number) || Number.isFinite(difficultyMax as number))
    opredSomeBase.difficulty = {
      ...(Number.isFinite(difficultyMin as number) ? { gte: difficultyMin as number } : {}),
      ...(Number.isFinite(difficultyMax as number) ? { lte: difficultyMax as number } : {}),
    };
  if (lenFilterField === "def" && (Number.isFinite(lenMin as number) || Number.isFinite(lenMax as number)))
    opredSomeBase.length = {
      ...(Number.isFinite(lenMin as number) ? { gte: lenMin as number } : {}),
      ...(Number.isFinite(lenMax as number) ? { lte: lenMax as number } : {}),
    };
  // Only include active (not expired) definitions when def-level filters are used
  const opredSome =
    Object.keys(opredSomeBase).length > 0
      ? {
          ...opredSomeBase,
          OR: [{ end_date: null }, { end_date: { gte: now } }],
        }
      : opredSomeBase;
  const opredWithSearch =
    q && (scope === "def" || scope === "both")
      ? {
          ...opredSome,
          text_opr: textFilter,
        }
      : null;

  const baseWhere = {
    ...(searchParams.get("isImageable") === "true" ? { isImageable: true } : {}),
    is_deleted: false,
    // filter words by selected dictionary language
    language: { is: { code: langCode } },
    ...whereLenWord,
    ...(Object.keys(opredSome).length > 0 ? { opred_v: { some: opredSome } } : {}),
  };

  const where =
    scope === "both" && wordSearch && opredWithSearch
      ? { ...baseWhere, OR: [wordSearch, { opred_v: { some: opredWithSearch } }] }
      : {
          ...baseWhere,
          ...(wordSearch ?? {}),
          ...(opredWithSearch && scope !== "both" ? { opred_v: { some: opredWithSearch } } : {}),
        };

  // Build include-level filter for definitions so that we only return matching ones
  const includeOpredWhere: Prisma.opred_vWhereInput = {
    is_deleted: false,
    OR: [{ end_date: null }, { end_date: { gte: now } }],
    language: { is: { code: langCode } },
    ...(tagNames.length
      ? {
          tags: {
            some: {
              tag: {
                OR: tagNames.map((name) => ({
                  name: { contains: name, mode: "insensitive" as const },
                })),
              },
            },
          },
        }
      : {}),
    ...(excludeTagNames.length
      ? {
          NOT: {
            tags: {
              some: {
                tag: {
                  OR: excludeTagNames.map((name) => ({
                    name: { contains: name, mode: "insensitive" as const },
                  })),
                },
              },
            },
          },
        }
      : {}),
    ...(lenFilterField === "def" && (Number.isFinite(lenMin as number) || Number.isFinite(lenMax as number))
      ? {
          length: {
            ...(Number.isFinite(lenMin as number) ? { gte: lenMin as number } : {}),
            ...(Number.isFinite(lenMax as number) ? { lte: lenMax as number } : {}),
          },
        }
      : {}),
    ...(Number.isFinite(difficulty as number)
      ? { difficulty: { equals: difficulty as number } }
      : Number.isFinite(difficultyMin as number) || Number.isFinite(difficultyMax as number)
        ? {
            difficulty: {
              ...(Number.isFinite(difficultyMin as number) ? { gte: difficultyMin as number } : {}),
              ...(Number.isFinite(difficultyMax as number) ? { lte: difficultyMax as number } : {}),
            },
          }
        : {}),
    ...(q && scope === "def" ? { text_opr: textFilter } : {}),
    ...(q && scope === "both"
      ? { AND: [{ OR: [{ word_v: { is: { word_text: textFilter } } }, { text_opr: textFilter }] }] }
      : {}),
  };

  const orderBy: Prisma.word_vOrderByWithRelationInput[] =
    sortField === "word" && sortDir
      ? [{ word_text: sortDir }, { id: "asc" }]
      : lenField === "word" && (lenDir === "asc" || lenDir === "desc")
        ? [{ length: lenDir }, { id: "asc" }]
        : [{ id: "asc" }];

  const opredOrderBy: Prisma.opred_vOrderByWithRelationInput[] = defSortDir
    ? [{ text_opr: defSortDir }, { id: "asc" }]
    : lenField === "def" && (lenDir === "asc" || lenDir === "desc")
      ? [{ length: lenDir }, { id: "asc" }]
      : [{ id: "asc" }];

  const wordWithDefsInclude = Prisma.validator<Prisma.word_vInclude>()({
    opred_v: {
      where: includeOpredWhere,
      select: {
        id: true,
        text_opr: true,
        difficulty: true,
        end_date: true,
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
      orderBy: opredOrderBy,
    },
  });

  type WordWithDefs = Prisma.word_vGetPayload<{ include: typeof wordWithDefsInclude }>;

  const baseQuery: Prisma.word_vFindManyArgs = {
    where,
    orderBy,
    take: take + 1,
    include: wordWithDefsInclude,
  } as const;

  const fetchBatch = (c?: bigint): Promise<WordWithDefs[]> =>
    prisma.word_v.findMany({
      ...baseQuery,
      ...(c ? { cursor: { id: c }, skip: 1 } : {}),
    }) as unknown as Promise<WordWithDefs[]>;

  type SearchableWord = {
    id: bigint | string;
    word_text: string;
    opred_v: Array<{ id: bigint | string; text_opr: string }>;
  };
  const filterBySearch = <T extends SearchableWord>(items: T[]) =>
    filterDictionarySearchRows(items, searchRegex, scope);

  // Fetch and, for "exact"/"startsWith" modes, keep pulling batches until the first page is filled with matching rows.
  const items = await fetchBatch(cursor);
  let hasMore = items.length > take;
  const collected = hasMore ? items.slice(0, take) : items;
  let collectedFiltered = filterBySearch(collected);
  let scanCursor: bigint | undefined = hasMore ? collected[collected.length - 1]?.id : undefined;

  if (searchRegex) {
    while (collectedFiltered.length < take && hasMore) {
      const nextBatch = await fetchBatch(scanCursor);
      if (!nextBatch.length) {
        hasMore = false;
        break;
      }
      hasMore = nextBatch.length > take;
      const slice = hasMore ? nextBatch.slice(0, take) : nextBatch;
      collected.push(...slice);
      collectedFiltered = filterBySearch(collected);
      scanCursor = hasMore ? slice[slice.length - 1]?.id : undefined;
    }
  }

  const pageRaw = searchRegex ? collectedFiltered.slice(0, take) : collected;
  const hasMoreFiltered = collectedFiltered.length > pageRaw.length;
  const nextCursor = (hasMore || hasMoreFiltered) && pageRaw.length ? String(pageRaw[pageRaw.length - 1].id) : null;

  // Pending status for words/definitions to hide edit buttons
  const wordIds = pageRaw.map((w) => w.id);
  const defIds = pageRaw.flatMap((w) => w.opred_v.map((d) => d.id));
  const [renamePendingsRaw, defPendingsRaw, defsCountRaw, imagesRaw] = await Promise.all([
    wordIds.length
      ? prisma.pendingWords.findMany({
          where: { status: "PENDING", targetWordId: { in: wordIds }, note: { contains: '"kind":"editWord"' } },
          select: { targetWordId: true },
        })
      : Promise.resolve([] as Array<{ targetWordId: bigint | null }>),
    defIds.length
      ? prisma.pendingDescriptions.findMany({
          where: {
            status: "PENDING",
            OR: defIds.map((id) => ({ note: { contains: `"opredId":"${String(id)}"` } })),
          },
          select: { note: true },
        })
      : Promise.resolve([] as Array<{ note: string }>),
    wordIds.length
      ? prisma.opred_v.groupBy({
          by: ["word_id"],
          where: {
            is_deleted: false,
            OR: [{ end_date: null }, { end_date: { gte: now } }],
            language: { is: { code: langCode } },
            word_id: { in: wordIds },
          },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ word_id: bigint; _count: { _all: number } }>),
    wordIds.length
      ? prisma.scanwordWordImage
          .findMany({
            where: { wordId: { in: wordIds } },
            select: { wordId: true },
            distinct: ["wordId"],
          })
          .catch((error: unknown) => {
            if (!isMissingWordImagesRelationError(error)) throw error;
            return [];
          })
      : Promise.resolve([]),
  ]);
  const wordsWithImages = new Set((imagesRaw ?? []).map((image) => String(image.wordId)));
  const renamePendings = renamePendingsRaw ?? [];
  const defPendings = defPendingsRaw ?? [];
  const wordPendingSet = new Set<string>(renamePendings.map((r) => String(r.targetWordId ?? "")));
  const defPendingSet = new Set<string>();
  for (const r of defPendings) {
    try {
      const parsed = JSON.parse(r.note) as { opredId?: string };
      if (parsed?.opredId) defPendingSet.add(parsed.opredId);
    } catch {}
  }
  const defsCountMap = new Map<string, number>();
  for (const row of defsCountRaw ?? []) {
    defsCountMap.set(String(row.word_id), row._count?._all ?? 0);
  }

  // Convert BigInt ids to string for JSON safety
  const safe = pageRaw.map((w) => ({
    id: String(w.id),
    word_text: w.word_text,
    isImageable: w.isImageable,
    hasImage: wordsWithImages.has(String(w.id)),
    is_pending_edit: wordPendingSet.has(String(w.id)),
    defs_total: defsCountMap.get(String(w.id)) ?? w.opred_v.length,
    opred_v: w.opred_v.map((d) => ({
      id: String(d.id),
      text_opr: d.text_opr,
      difficulty: d.difficulty,
      end_date: d.end_date ? d.end_date.toISOString() : null,
      is_pending_edit: defPendingSet.has(String(d.id)),
      tags: d.tags.map((t) => ({ tag: { id: t.tag.id, name: t.tag.name } })),
    })),
  }));

  const total = await prisma.word_v.count({ where });
  const totalDefs = await prisma.opred_v.count({
    where: {
      ...includeOpredWhere,
      word_v: { is: where },
    },
  });

  let totalFiltered = total;
  let totalDefsFiltered = totalDefs;
  if (searchRegex) {
    const forCount = await prisma.word_v.findMany({
      where,
      select: {
        id: true,
        word_text: true,
        opred_v: {
          where: includeOpredWhere,
          select: { id: true, text_opr: true },
        },
      },
    });
    const mapped = forCount.map((w) => ({
      ...w,
      id: String(w.id),
      opred_v: w.opred_v.map((d) => ({ ...d, id: String(d.id) })),
    }));
    const filteredForCount = filterBySearch(mapped);
    totalFiltered = filteredForCount.length;
    totalDefsFiltered = filteredForCount.reduce((acc, w) => acc + w.opred_v.length, 0);
  }

  return NextResponse.json({
    items: safe,
    nextCursor,
    total: searchRegex ? totalFiltered : total,
    totalDefs: searchRegex ? totalDefsFiltered : totalDefs,
  });
};

export const GET = apiRoute(getHandler, { requireAuth: true });
