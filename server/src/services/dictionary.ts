import { PrismaClient } from "@prisma/client";

export async function loadDictionary(): Promise<Map<number, string[]>> {
  const prisma = new PrismaClient();
  try {
    const words = await prisma.word_v.findMany(); // модель Word из schema.prisma
    const map = new Map<number, string[]>();
    for (const { word_text, length } of words) {
      const arr = map.get(length) ?? [];
      arr.push(word_text.toUpperCase());
      map.set(length, arr);
    }
    return map;
  } finally {
    await prisma.$disconnect();
  }
}

export async function loadDefinitions(
  words: string[]
): Promise<Map<string, string>> {
  const prisma = new PrismaClient();
  try {
    const unique = [...new Set(words.map((w) => w.toUpperCase()))];
    if (!unique.length) return new Map();

    const wordFilters = unique.map((word) => ({
      word_text: { equals: word, mode: "insensitive" as const },
    }));

    const rows = await prisma.word_v.findMany({
      where: {
        is_deleted: false,
        OR: wordFilters,
      },
      include: {
        opred_v: {
          where: {
            is_deleted: false,
          },
          orderBy: {
            id: "asc",
          },
        },
      },
    });

    const map = new Map<string, string>();
    for (const row of rows) {
      const def = row.opred_v.find((o) => o.text_opr.trim().length > 0);
      map.set(row.word_text.toUpperCase(), def?.text_opr ?? "");
    }
    return map;
  } finally {
    await prisma.$disconnect();
  }
}
