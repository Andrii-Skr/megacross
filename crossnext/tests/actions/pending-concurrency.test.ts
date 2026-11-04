import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvePendingAction, rejectPendingAction, savePendingAction } from "@/app/actions/admin-pending";
import { setAuthed } from "../mocks";

const { db } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    pendingWords: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    pendingDescriptions: { update: vi.fn() },
    word_v: { update: vi.fn() },
    opred_v: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/authz", () => ({
  Permissions: { PendingReview: "pending:review" },
  hasPermissionAsync: async () => true,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "ru" }));
const form = () => {
  const data = new FormData();
  data.set("id", "1");
  return data;
};
let card: Record<string, unknown>;
let definitions: Array<{ id: bigint; text_opr: string }>;
beforeEach(() => {
  vi.clearAllMocks();
  setAuthed({ id: "17", role: "ADMIN" });
  card = {
    id: 1n,
    targetWordId: 10n,
    status: "PENDING",
    word_text: "кактус",
    length: 6,
    langId: 3,
    note: "{}",
    descriptions: [{ id: 2n, description: "Растение", difficulty: 1, note: "" }],
    language: { code: "ru", wordReplaceMap: null },
  };
  definitions = [];
  let tail = Promise.resolve();
  db.$transaction.mockImplementation(async (callback) => {
    let release: (() => void) | undefined;
    const tx = {
      ...db,
      $queryRaw: async () => {
        if (release) return [];
        const previous = tail;
        tail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        return [{ id: 1n }];
      },
    };
    try {
      return await callback(tx);
    } finally {
      release?.();
    }
  });
  db.pendingWords.findUnique.mockImplementation(async () => structuredClone(card));
  db.pendingWords.findMany.mockResolvedValue([]);
  db.pendingWords.update.mockImplementation(async ({ data }) => {
    Object.assign(card, data);
    return card;
  });
  db.opred_v.findMany.mockImplementation(async () => structuredClone(definitions));
  db.opred_v.create.mockImplementation(async ({ data }) => {
    const row = { id: BigInt(20 + definitions.length), text_opr: data.text_opr };
    definitions.push(row);
    return row;
  });
});

describe("pending card concurrency", () => {
  it("publishes one definition when two moderators approve together", async () => {
    await Promise.all([approvePendingAction(form()), approvePendingAction(form())]);
    expect(definitions).toHaveLength(1);
    expect(card.status).toBe("APPROVED");
    expect(db.pendingDescriptions.update).toHaveBeenCalledOnce();
  });
  it("keeps an approved card approved when a concurrent rejection follows", async () => {
    await Promise.all([approvePendingAction(form()), rejectPendingAction(form())]);
    expect(card.status).toBe("APPROVED");
    expect(definitions).toHaveLength(1);
  });
  it("does not publish anything when rejection wins the lock", async () => {
    await Promise.all([rejectPendingAction(form()), approvePendingAction(form())]);
    expect(card.status).toBe("REJECTED");
    expect(definitions).toEqual([]);
  });
  it("does not edit an already resolved card while approval is finishing", async () => {
    const editing = form();
    editing.set("word", "изменено");
    await Promise.all([approvePendingAction(form()), savePendingAction(editing)]);
    expect(card.word_text).toBe("кактус");
    expect(card.status).toBe("APPROVED");
  });
});
