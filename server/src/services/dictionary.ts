import { PrismaClient } from "@prisma/client";

export async function loadDictionary(): Promise<Map<number, string[]>> {
  const prisma = new PrismaClient();
  try {
    const words = await prisma.words_v.findMany(); // модель Word из schema.prisma
    const map = new Map<number, string[]>();
    for (const { word_text, word_length } of words) {
      const arr = map.get(word_length) ?? [];
      arr.push(word_text.toUpperCase());
      map.set(word_length, arr);
    }
    return map;
  } finally {
    await prisma.$disconnect();
  }
}
