import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type WordPayload = Prisma.word_vGetPayload<{
  include: {
    opred_v: { include: { opred_tags: { include: { tags: true } } } };
  };
}>;

type WordWithTagNames = Omit<WordPayload, "opred_v"> & {
  opred_v: Array<
    Omit<WordPayload["opred_v"][number], "opred_tags"> & { tags: string[] }
  >;
};

const containsInsensitive = (value?: string) =>
  value ? { contains: value, mode: "insensitive" as const } : undefined;

export async function getWordsAndDefinitions(
  wordTextFilter?: string,
  definitionTextFilter?: string,
  tagNames?: string[]
): Promise<WordWithTagNames[]> {
  const wordWhere: Prisma.word_vWhereInput = {
    is_deleted: false,
  };

  const wordText = containsInsensitive(wordTextFilter);
  if (wordText) wordWhere.word_text = wordText;

  const opredWhere: Prisma.opred_vWhereInput = {
    is_deleted: false,
  };

  const definitionText = containsInsensitive(definitionTextFilter);
  if (definitionText) opredWhere.text_opr = definitionText;

  if (tagNames && tagNames.length > 0) {
    opredWhere.opred_tags = {
      some: {
        tags: {
          name: {
            in: tagNames,
            mode: "insensitive",
          },
        },
      },
    };
  }

  if (definitionText || (tagNames && tagNames.length > 0)) {
    wordWhere.opred_v = {
      some: opredWhere,
    };
  }

  const words = await prisma.word_v.findMany({
    where: wordWhere,
    include: {
      opred_v: {
        where: opredWhere,
        include: {
          opred_tags: {
            include: {
              tags: true,
            },
          },
        },
      },
    },
  });

  return words.map((word) => ({
    ...word,
    opred_v: (word.opred_v ?? []).map((opred) => ({
      ...opred,
      tags: (opred.opred_tags ?? []).map(
        (opredTag) => opredTag.tags?.name ?? ""
      ),
    })),
  }));
}

export async function getAllTags() {
  type TagRow = { id: number | string; name: string };
  type TagModel = {
    findMany: (args: {
      select: { id: true; name: true };
      orderBy: { name: "asc" };
    }) => Promise<TagRow[]>;
  };

  const prismaAny = prisma as unknown as {
    tag?: TagModel;
    tags?: TagModel;
  };
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
