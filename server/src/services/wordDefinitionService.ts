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

type WordQueryPagination = {
  page?: number;
  pageSize?: number;
};

export type WordQueryResult = {
  items: WordWithTagNames[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_WORDS_PAGE_SIZE = 100;
const MAX_WORDS_PAGE_SIZE = 500;

const containsInsensitive = (value?: string) =>
  value ? { contains: value, mode: "insensitive" as const } : undefined;

export async function getWordsAndDefinitions(
  wordTextFilter?: string,
  definitionTextFilter?: string,
  tagNames?: string[],
  pagination: WordQueryPagination = {}
): Promise<WordQueryResult> {
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

  const pageRaw = Number.isFinite(pagination.page) ? Number(pagination.page) : 1;
  const pageSizeRaw = Number.isFinite(pagination.pageSize)
    ? Number(pagination.pageSize)
    : DEFAULT_WORDS_PAGE_SIZE;
  const page = Math.max(1, Math.trunc(pageRaw));
  const pageSize = Math.max(1, Math.min(MAX_WORDS_PAGE_SIZE, Math.trunc(pageSizeRaw)));
  const skip = (page - 1) * pageSize;

  const total = await prisma.word_v.count({
    where: wordWhere,
  });

  const words = await prisma.word_v.findMany({
    where: wordWhere,
    skip,
    take: pageSize,
    orderBy: {
      id: "asc",
    },
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

  const items = words.map((word) => ({
    ...word,
    opred_v: (word.opred_v ?? []).map((opred) => ({
      ...opred,
      tags: (opred.opred_tags ?? []).map(
        (opredTag) => opredTag.tags?.name ?? ""
      ),
    })),
  }));

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
  };
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
