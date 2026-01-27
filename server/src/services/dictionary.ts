import { PrismaClient } from "@prisma/client";

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
};

export async function loadDictionary(
  options: DictionaryOptions = {}
): Promise<Map<number, string[]>> {
  const prisma = new PrismaClient();
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
    for (const { word_text, word_text_norm, length } of words) {
      const arr = map.get(length) ?? [];
      const normalized = word_text_norm?.trim();
      const text = normalized && normalized.length > 0 ? normalized : word_text;
      arr.push(text.toUpperCase());
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
  const prisma = new PrismaClient();
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

    const opredWhere: any = {
      text_opr: { not: "" },
    };
    if (!options.includeDeleted) opredWhere.is_deleted = false;
    if (langId !== undefined) opredWhere.langId = langId;

    const rows = await prisma.word_v.findMany({
      where,
      select: {
        word_text: true,
        word_text_norm: true,
        opred_v: {
          where: opredWhere,
          orderBy: { id: "asc" },
          select: { text_opr: true },
        },
      },
    });

    const map = new Map<string, string>();
    for (const row of rows) {
      const def = row.opred_v.find((o) => o.text_opr.trim().length > 0);
      const normalized = row.word_text_norm?.trim();
      const text = normalized && normalized.length > 0 ? normalized : row.word_text;
      map.set(text.toUpperCase(), def?.text_opr ?? "");
    }
    return map;
  } finally {
    await prisma.$disconnect();
  }
}
