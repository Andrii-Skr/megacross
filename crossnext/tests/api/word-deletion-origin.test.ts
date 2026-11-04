import { beforeEach, describe, expect, it } from "vitest";
import { POST as restoreDefinition } from "../../app/api/dictionary/def/[id]/restore/route";
import { DELETE as deleteDefinition } from "../../app/api/dictionary/def/[id]/route";
import { POST as restoreWord } from "../../app/api/dictionary/word/[id]/restore/route";
import { DELETE as deleteWord } from "../../app/api/dictionary/word/[id]/route";
import { prisma, resetMocks, setAuthed } from "../mocks";
import { makeCtx, makeReq } from "./_utils";

const definitions = [
  { id: 1n, word_id: 10n, is_deleted: true, deletedWithWord: false },
  { id: 2n, word_id: 10n, is_deleted: false, deletedWithWord: false },
];
const mutateWord = async (handler: typeof deleteWord, method: string) => {
  const response = await handler(
    makeReq(method, "http://localhost/api/dictionary/word/10", method === "POST" ? {} : undefined),
    makeCtx({ id: "10" }),
  );
  expect(response.status).toBe(200);
};
const mutateDefinition = async (handler: typeof deleteDefinition, method: string) => {
  const response = await handler(
    makeReq(method, "http://localhost/api/dictionary/def/2", method === "POST" ? {} : undefined),
    makeCtx({ id: "2" }),
  );
  expect(response.status).toBe(200);
};
beforeEach(() => {
  resetMocks();
  setAuthed({ id: "17", role: "ADMIN" });
  definitions[0] = { id: 1n, word_id: 10n, is_deleted: true, deletedWithWord: false };
  definitions[1] = { id: 2n, word_id: 10n, is_deleted: false, deletedWithWord: false };
  prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  prisma.word_v.update.mockResolvedValue({ id: 10n });
  prisma.opred_v.updateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    for (const row of definitions) {
      if (
        row.word_id === where.word_id &&
        (where.is_deleted === undefined || row.is_deleted === where.is_deleted) &&
        (where.deletedWithWord === undefined || row.deletedWithWord === where.deletedWithWord)
      ) {
        Object.assign(row, data);
        count++;
      }
    }
    return { count };
  });
  prisma.opred_v.update.mockImplementation(async ({ where, data }) => {
    const row = definitions.find((item) => item.id === where.id);
    if (!row) throw new Error("Missing test definition");
    Object.assign(row, data);
    return row;
  });
});

describe("word deletion origin", () => {
  it("restores only definitions deleted with the word, preserving independent deletions", async () => {
    await mutateWord(deleteWord, "DELETE");
    expect(definitions[0]).toMatchObject({ is_deleted: true, deletedWithWord: false });
    expect(definitions[1]).toMatchObject({ is_deleted: true, deletedWithWord: true });
    await mutateWord(deleteWord, "DELETE");
    await mutateWord(restoreWord, "POST");
    expect(definitions[0]).toMatchObject({ is_deleted: true, deletedWithWord: false });
    expect(definitions[1]).toMatchObject({ is_deleted: false, deletedWithWord: false });
    await mutateWord(restoreWord, "POST");
    expect(definitions[0].is_deleted).toBe(true);
  });
  it("keeps an explicitly deleted definition deleted even after its parent is restored", async () => {
    await mutateWord(deleteWord, "DELETE");
    await mutateDefinition(deleteDefinition, "DELETE");
    await mutateWord(restoreWord, "POST");
    expect(definitions[1]).toMatchObject({ is_deleted: true, deletedWithWord: false });
  });
  it("clears the cascade marker when a definition is explicitly restored", async () => {
    await mutateWord(deleteWord, "DELETE");
    await mutateDefinition(restoreDefinition, "POST");
    expect(definitions[1]).toMatchObject({ is_deleted: false, deletedWithWord: false });
  });
  it("does not resurrect ambiguous legacy deletions without a recorded origin", async () => {
    definitions[1].is_deleted = true;
    await mutateWord(restoreWord, "POST");
    expect(definitions.every((row) => row.is_deleted)).toBe(true);
  });
});
