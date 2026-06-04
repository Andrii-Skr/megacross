import { Prisma, createPrismaClient } from "../db/prisma";

export type DictionaryOptions = {
  lengths?: number[];
  langCode?: string;
  langId?: number;
  includeDeleted?: boolean;
};

export type DefinitionOptions = {
  langCode?: string;
  langId?: number;
  includeDeleted?: boolean;
  definitionWhere?: Prisma.opred_vWhereInput;
};

const SHORT_DEFINITION_LIMIT = 30;

function normalizeDefinitionText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeDefinitionKey(value: string | null | undefined): string {
  return normalizeDefinitionText(value).toLocaleLowerCase("ru");
}

function definitionSelectionBucket(text: string, usedDefinitions: Set<string>): number {
  const key = normalizeDefinitionKey(text);
  const isUnique = !usedDefinitions.has(key);
  if (!isUnique) return Number.POSITIVE_INFINITY;
  const isShort = normalizeDefinitionText(text).length < SHORT_DEFINITION_LIMIT;
  if (isUnique && isShort) return 0;
  if (isUnique) return 1;
  return Number.POSITIVE_INFINITY;
}

export async function loadDictionary(
  options: DictionaryOptions = {}
): Promise<Map<number, string[]>> {
  const prisma = createPrismaClient();
  try {
    const lengthList = options.lengths
      ? [...new Set(options.lengths)]
          .map((n) => Math.trunc(n))
          .filter((n) => Number.isFinite(n) && n > 0)
      : undefined;
    if (lengthList && lengthList.length === 0) return new Map<number, string[]>();

    let langId = options.langId;
    if (langId === undefined && options.langCode) {
      const lang = await prisma.language.findUnique({
        where: { code: options.langCode },
        select: { id: true },
      });
      if (!lang) return new Map<number, string[]>();
      langId = lang.id;
    }

    const where: any = {};
    if (!options.includeDeleted) where.is_deleted = false;
    if (langId !== undefined) where.langId = langId;
    if (lengthList && lengthList.length > 0) where.length = { in: lengthList };

    const words = await prisma.word_v.findMany({
      where,
      select: { word_text: true, word_text_norm: true, length: true },
    }); // модель Word из schema.prisma
    const map = new Map<number, string[]>();
    const seenByLen = new Map<number, Set<string>>();
    for (const { word_text, word_text_norm, length } of words) {
      const normalized = word_text_norm?.trim();
      const text = normalized && normalized.length > 0 ? normalized : word_text;
      const word = text.toUpperCase();
      const seen = seenByLen.get(length) ?? new Set<string>();
      if (seen.has(word)) continue;
      seen.add(word);
      seenByLen.set(length, seen);
      const arr = map.get(length) ?? [];
      arr.push(word);
      map.set(length, arr);
    }
    return map;
  } finally {
    await prisma.$disconnect();
  }
}

export async function loadDefinitions(
  words: string[],
  options: DefinitionOptions = {}
): Promise<Map<string, string>> {
  const prisma = createPrismaClient();
  try {
    const unique = [...new Set(words.map((w) => w.toUpperCase()))];
    if (!unique.length) return new Map();

    let langId = options.langId;
    if (langId === undefined && options.langCode) {
      const lang = await prisma.language.findUnique({
        where: { code: options.langCode },
        select: { id: true },
      });
      if (!lang) return new Map();
      langId = lang.id;
    }

    const where: any = {
      OR: [
        { word_text_norm: { in: unique, mode: "insensitive" as const } },
        { word_text: { in: unique, mode: "insensitive" as const } },
      ],
    };
    if (!options.includeDeleted) where.is_deleted = false;
    if (langId !== undefined) where.langId = langId;

    const opredWhereBase: Prisma.opred_vWhereInput = {
      text_opr: { not: "" },
    };
    if (!options.includeDeleted) opredWhereBase.is_deleted = false;
    if (langId !== undefined) opredWhereBase.langId = langId;

    const opredWhere: Prisma.opred_vWhereInput = options.definitionWhere
      ? { AND: [opredWhereBase, options.definitionWhere] }
      : opredWhereBase;

    const rows = await prisma.word_v.findMany({
      where,
      select: {
        word_text: true,
        word_text_norm: true,
        opred_v: {
          where: opredWhere,
          orderBy: { id: "asc" },
          select: { id: true, text_opr: true },
        },
      },
    });

    const byWord = new Map<string, Array<{ id: bigint; text: string }>>();
    for (const row of rows) {
      const normalized = row.word_text_norm?.trim();
      const text = normalized && normalized.length > 0 ? normalized : row.word_text;
      const key = text.toUpperCase();
      const list = byWord.get(key) ?? [];
      for (const opred of row.opred_v) {
        const definition = normalizeDefinitionText(opred.text_opr);
        if (!definition) continue;
        list.push({ id: opred.id, text: definition });
      }
      byWord.set(key, list);
    }

    const usedDefinitions = new Set<string>();
    const map = new Map<string, string>();
    for (const [word, candidates] of byWord) {
      let best: { id: bigint; text: string; bucket: number; len: number } | null = null;
      for (const candidate of candidates) {
        const bucket = definitionSelectionBucket(candidate.text, usedDefinitions);
        if (!Number.isFinite(bucket)) continue;
        const len = candidate.text.length;
        if (
          !best ||
          bucket < best.bucket ||
          (bucket === best.bucket &&
            (len < best.len || (len === best.len && candidate.id < best.id)))
        ) {
          best = {
            id: candidate.id,
            text: candidate.text,
            bucket,
            len,
          };
        }
      }
      if (best?.text) {
        map.set(word, best.text);
        usedDefinitions.add(normalizeDefinitionKey(best.text));
      } else {
        map.set(word, "");
      }
    }
    return map;
  } finally {
    await prisma.$disconnect();
  }
}

export type DictionaryFilterTemplate = {
  language: string;
  query?: string | null;
  scope?: "word" | "def" | "both" | string | null;
  searchMode?: "contains" | "startsWith" | "exact" | string | null;
  lenFilterField?: "word" | "def" | string | null;
  lenMin?: number | null;
  lenMax?: number | null;
  difficultyMin?: number | null;
  difficultyMax?: number | null;
  tagNames?: string[] | null;
  excludeTagNames?: string[] | null;
};

type DictionaryTemplateOptions = {
  lengths?: number[];
};

export async function loadDictionaryByTemplate(
  template: DictionaryFilterTemplate,
  options: DictionaryTemplateOptions = {}
): Promise<Map<number, string[]>> {
  const prisma = createPrismaClient();
  try {
    const langCode = (template.language || "ru").toLowerCase();
    const query = template.query?.trim() || "";
    const scopeRaw = (template.scope || "word").toLowerCase();
    const scope = scopeRaw === "def" || scopeRaw === "both" ? scopeRaw : "word";
    const modeRaw = (template.searchMode || "contains").toLowerCase();
    const searchMode: "contains" | "startsWith" | "exact" =
      modeRaw === "startsWith" ? "startsWith" : modeRaw === "exact" ? "exact" : "contains";
    let lenFilterField =
      template.lenFilterField === "def" || template.lenFilterField === "word"
        ? template.lenFilterField
        : null;
    const lenMin = Number.isFinite(template.lenMin as number) ? Math.trunc(template.lenMin as number) : undefined;
    const lenMax = Number.isFinite(template.lenMax as number) ? Math.trunc(template.lenMax as number) : undefined;
    if (!lenFilterField && (lenMin !== undefined || lenMax !== undefined)) {
      lenFilterField = "word";
    }
    const difficultyMin = Number.isFinite(template.difficultyMin as number)
      ? Math.trunc(template.difficultyMin as number)
      : undefined;
    const difficultyMax = Number.isFinite(template.difficultyMax as number)
      ? Math.trunc(template.difficultyMax as number)
      : undefined;
    const tagNames = (template.tagNames ?? []).map((t) => t.trim()).filter(Boolean);
    const excludeTagNames = (template.excludeTagNames ?? []).map((t) => t.trim()).filter(Boolean);

    const textFilter =
      query.length > 0
        ? searchMode === "contains"
          ? { contains: query, mode: "insensitive" as const }
          : searchMode === "startsWith"
            ? { startsWith: query, mode: "insensitive" as const }
            : { equals: query, mode: "insensitive" as const }
        : null;

    const now = new Date();
    const lengthFilter: Prisma.IntFilter = {};
    if (lenFilterField === "word" && (lenMin !== undefined || lenMax !== undefined)) {
      if (lenMin !== undefined) lengthFilter.gte = lenMin;
      if (lenMax !== undefined) lengthFilter.lte = lenMax;
    }

    const opredSomeBase: Record<string, unknown> = {
      language: { is: { code: langCode } },
      is_deleted: false,
    };
    if (tagNames.length) {
      opredSomeBase.opred_tags = {
        some: {
          tags: {
            OR: tagNames.map((name) => ({
              name: { contains: name, mode: "insensitive" as const },
            })),
          },
        },
      };
    }
    if (excludeTagNames.length) {
      opredSomeBase.NOT = {
        opred_tags: {
          some: {
            tags: {
              OR: excludeTagNames.map((name) => ({
                name: { contains: name, mode: "insensitive" as const },
              })),
            },
          },
        },
      };
    }
    if (difficultyMin !== undefined || difficultyMax !== undefined) {
      opredSomeBase.difficulty = {
        ...(difficultyMin !== undefined ? { gte: difficultyMin } : {}),
        ...(difficultyMax !== undefined ? { lte: difficultyMax } : {}),
      };
    }
    if (lenFilterField === "def" && (lenMin !== undefined || lenMax !== undefined)) {
      opredSomeBase.length = {
        ...(lenMin !== undefined ? { gte: lenMin } : {}),
        ...(lenMax !== undefined ? { lte: lenMax } : {}),
      };
    }
    if (Object.keys(opredSomeBase).length > 0) {
      opredSomeBase.OR = [{ end_date: null }, { end_date: { gte: now } }];
    }

    const opredWithSearch =
      query.length > 0 && (scope === "def" || scope === "both") && textFilter
        ? {
            ...opredSomeBase,
            text_opr: textFilter,
          }
        : null;

    const wordSearch =
      query.length > 0 && (scope === "word" || scope === "both") && textFilter
        ? { word_text: textFilter }
        : undefined;

    const baseWhere: Prisma.word_vWhereInput = {
      is_deleted: false,
      language: { is: { code: langCode } },
      ...(Object.keys(opredSomeBase).length > 0 ? { opred_v: { some: opredSomeBase } } : {}),
    };

    const where: Prisma.word_vWhereInput =
      scope === "both" && wordSearch && opredWithSearch
        ? {
            ...baseWhere,
            OR: [wordSearch, { opred_v: { some: opredWithSearch } }],
          }
        : {
            ...baseWhere,
            ...(wordSearch ?? {}),
            ...(opredWithSearch && scope !== "both" ? { opred_v: { some: opredWithSearch } } : {}),
          };

    const lengths = options.lengths
      ? [...new Set(options.lengths)].map((n) => Math.trunc(n)).filter((n) => Number.isFinite(n) && n > 0)
      : undefined;
    if (lengths && lengths.length === 0) return new Map<number, string[]>();
    if (lengths && lengths.length > 0) {
      lengthFilter.in = lengths;
    }
    if (Object.keys(lengthFilter).length > 0) {
      where.length = lengthFilter;
    }

    const rows = await prisma.word_v.findMany({
      where,
      select: { word_text: true, word_text_norm: true, length: true },
    });

    const map = new Map<number, string[]>();
    const seenByLen = new Map<number, Set<string>>();
    for (const row of rows) {
      const normalized = row.word_text_norm?.trim();
      const text = normalized && normalized.length > 0 ? normalized : row.word_text;
      const word = text.toUpperCase();
      const seen = seenByLen.get(row.length) ?? new Set<string>();
      if (seen.has(word)) continue;
      seen.add(word);
      seenByLen.set(row.length, seen);
      const arr = map.get(row.length) ?? [];
      arr.push(word);
      map.set(row.length, arr);
    }
    return map;
  } finally {
    await prisma.$disconnect();
  }
}
