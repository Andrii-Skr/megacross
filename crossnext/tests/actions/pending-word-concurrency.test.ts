import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvePendingAction } from "@/app/actions/admin-pending";
import { setAuthed } from "../mocks";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  pendingWords: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  pendingDescriptions: { update: vi.fn() },
  word_v: { findFirst: vi.fn(), create: vi.fn() },
  opred_v: { findMany: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/authz", () => ({
  Permissions: { PendingReview: "pending:review" },
  hasPermissionAsync: async () => true,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "ru" }));
let cards: Map<bigint, Record<string, unknown>>;
let words: { id: bigint; word_text: string }[];
let definitions: { id: bigint; word_id: bigint; text_opr: string }[];
beforeEach(() => {
  vi.clearAllMocks();
  setAuthed({ id: "17", role: "ADMIN" });
  words = [];
  definitions = [];
  cards = new Map(
    [1n, 2n].map((id) => [
      id,
      {
        id,
        targetWordId: null,
        status: "PENDING",
        word_text: "кактус",
        length: 6,
        langId: 3,
        note: "{}",
        language: { code: "ru", wordReplaceMap: null },
        descriptions: [{ id: id + 10n, description: "Растение", difficulty: 1, note: "" }],
      },
    ]),
  );
  const locks = new Map<string, Promise<void>>();
  db.$transaction.mockImplementation(async (callback) => {
    const releases: (() => void)[] = [];
    const held = new Set<string>();
    const tx = {
      ...db,
      $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
        const key = `${sql.join("?")}:${values.map(String).join(":")}`;
        if (!held.has(key)) {
          held.add(key);
          const previous = locks.get(key) ?? Promise.resolve();
          locks.set(key, new Promise<void>((resolve) => releases.push(resolve)));
          await previous;
        }
        return [];
      },
    };
    try {
      return await callback(tx);
    } finally {
      for (const release of releases.reverse()) release();
    }
  });
  db.pendingWords.findUnique.mockImplementation(async ({ where }) => structuredClone(cards.get(where.id)));
  db.pendingWords.findMany.mockResolvedValue([]);
  db.pendingWords.update.mockImplementation(async ({ where, data }) => Object.assign(cards.get(where.id) ?? {}, data));
  db.word_v.findFirst.mockImplementation(async () => words[0] ?? null);
  db.word_v.create.mockImplementation(async ({ data }) => {
    const row = { id: BigInt(100 + words.length), word_text: data.word_text };
    words.push(row);
    return row;
  });
  db.opred_v.findMany.mockImplementation(async ({ where }) =>
    structuredClone(definitions.filter((def) => def.word_id === where.word_id)),
  );
  db.opred_v.create.mockImplementation(async ({ data }) => {
    const row = { id: BigInt(200 + definitions.length), word_id: data.word_id, text_opr: data.text_opr };
    definitions.push(row);
    return row;
  });
});
describe("concurrent approval of different pending cards for one word", () => {
  it.each([false, true])("deduplicates words and definitions when the target exists=%s", async (existing) => {
    if (existing) {
      words.push({ id: 100n, word_text: "кактус" });
      for (const card of cards.values()) card.targetWordId = 100n;
    }
    const form = (id: string) => {
      const data = new FormData();
      data.set("id", id);
      return data;
    };
    await Promise.all([approvePendingAction(form("1")), approvePendingAction(form("2"))]);
    expect(words).toHaveLength(1);
    expect(definitions).toHaveLength(1);
    expect([...cards.values()].map((card) => card.status)).toEqual(["APPROVED", "APPROVED"]);
  });
});
