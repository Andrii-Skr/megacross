import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getWordsAndDefinitions(
  wordTextFilter?: string,
  definitionTextFilter?: string,
  tagNames?: string[]
) {
  const whereClause: any = {
    is_deleted: false,
  };

  if (wordTextFilter) {
    whereClause.word_text = {
      contains: wordTextFilter,
      mode: "insensitive",
    };
  }

  const opredWhereClause: any = {
    is_deleted: false,
  };

  if (definitionTextFilter) {
    opredWhereClause.text_opr = {
      contains: definitionTextFilter,
      mode: "insensitive",
    };
  }

  if (tagNames && tagNames.length > 0) {
    opredWhereClause.tags = {
      some: {
        tag: {
          name: {
            in: tagNames,
            mode: "insensitive",
          },
        },
      },
    };
  }

  const words = (await prisma.word_v.findMany({
    where: whereClause,
    include: {
      opred_v: {
        where: opredWhereClause,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      },
    },
  } as any)) as any[];

  return words.map((word) => ({
    ...word,
    opred_v: (word.opred_v ?? []).map((opred: any) => ({
      ...opred,
      tags: Array.isArray(opred.tags)
        ? opred.tags.map((opredTag: any) => opredTag.tag?.name ?? "")
        : [],
    })),
  }));
}

export async function getAllTags() {
  const prismaAny = prisma as any;
  const tagModel = prismaAny.tag ?? prismaAny.tags;
  if (!tagModel) return [];
  return tagModel.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}
