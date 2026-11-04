import { beforeEach, describe, expect, it, vi } from "vitest";
import { approvePendingAction, rejectPendingAction, savePendingAction } from "@/app/actions/admin-pending";
import { hasPermissionAsync } from "@/lib/authz";
import { setAuthed } from "../mocks";

const { db } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    pendingWords: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    pendingDescriptions: {
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    word_v: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    opred_v: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/authz", () => ({
  Permissions: { PendingReview: "pending:review" },
  hasPermissionAsync: vi.fn(async () => true),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "ru") }));

const form = () => {
  const data = new FormData();
  data.set("id", "1");
  return data;
};
const pending = (isImageable?: boolean, isNew = false) => ({
  id: 1n,
  targetWordId: isNew ? null : 10n,
  status: "PENDING",
  word_text: "кактус",
  length: 6,
  langId: 3,
  note: JSON.stringify({ kind: isNew ? "newWord" : "editWord", isImageable }),
  descriptions: isNew ? [{ id: 2n, description: "Растение", difficulty: 1, note: "" }] : [],
  language: { code: "ru", wordReplaceMap: null },
});

describe("imageability moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasPermissionAsync).mockResolvedValue(true);
    setAuthed({ id: "17", role: "ADMIN" });
    db.$transaction.mockImplementation(async (cb) => cb(db));
    db.pendingWords.findMany.mockResolvedValue([]);
    db.opred_v.findMany.mockResolvedValue([]);
    db.opred_v.create.mockResolvedValue({ id: 20n });
    db.word_v.findFirst.mockResolvedValue(null);
    db.word_v.create.mockResolvedValue({ id: 10n });
  });

  it.each([true, false])("applies %s when a word edit is approved", async (value) => {
    db.pendingWords.findUnique.mockResolvedValue(pending(value));
    await approvePendingAction(form());
    expect(db.word_v.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { isImageable: value } });
    expect(db.pendingWords.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }),
    );
  });

  it("preserves the current flag when an old request omits it", async () => {
    db.pendingWords.findUnique.mockResolvedValue(pending());
    await approvePendingAction(form());
    for (const [args] of db.word_v.update.mock.calls) expect(args.data).not.toHaveProperty("isImageable");
  });

  it("creates a marked word only after approval", async () => {
    db.pendingWords.findUnique.mockResolvedValue(pending(true, true));
    await approvePendingAction(form());
    expect(db.word_v.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isImageable: true }) }),
    );
  });

  it("does not change the word when a request is rejected", async () => {
    db.pendingWords.findUnique.mockResolvedValue(pending(true));
    await rejectPendingAction(form());
    expect(db.word_v.update).not.toHaveBeenCalled();
    expect(db.word_v.create).not.toHaveBeenCalled();
    expect(db.pendingWords.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { status: "REJECTED" } });
  });

  it.each([
    "text",
    "diff",
    "end",
    "tags",
  ])("rejects a foreign desc_%s ID before changing any records", async (field) => {
    db.pendingWords.findUnique.mockResolvedValue(pending());
    db.pendingDescriptions.findMany.mockResolvedValue([]);
    const data = form();
    data.set("word", "изменение");
    data.set(`desc_${field}_999`, "1");
    await expect(savePendingAction(data)).rejects.toMatchObject({ status: 403 });
    expect(db.pendingWords.update).not.toHaveBeenCalled();
    expect(db.pendingDescriptions.update).not.toHaveBeenCalled();
  });

  it.each([0, 1])("retains at least one definition when %s descriptions would remain", async (remaining) => {
    db.pendingWords.findUnique.mockResolvedValue(pending(undefined, true));
    db.pendingDescriptions.findMany.mockResolvedValue([{ id: 2n, end_date: null }]);
    db.pendingDescriptions.count.mockResolvedValue(remaining);
    const data = form();
    data.set("delete_desc_ids", "2");
    if (remaining === 0) {
      await expect(savePendingAction(data)).rejects.toMatchObject({ status: 400 });
      expect(db.pendingDescriptions.deleteMany).not.toHaveBeenCalled();
    } else {
      await savePendingAction(data);
      expect(db.pendingDescriptions.deleteMany).toHaveBeenCalledOnce();
    }
  });

  it("saves an explicit date removal and preserves note metadata and tags", async () => {
    db.pendingWords.findUnique.mockResolvedValue(pending());
    db.pendingDescriptions.findMany.mockResolvedValue([{ id: 2n, end_date: new Date("2027-01-01T00:00:00Z") }]);
    db.pendingDescriptions.findUnique.mockResolvedValue({ note: JSON.stringify({ kind: "editDef", opredId: "20" }) });
    const data = form();
    data.set("desc_end_2", "");
    data.set("desc_tags_2", "[7]");
    await savePendingAction(data);
    expect(db.pendingDescriptions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2n, pendingWordId: 1n, status: "PENDING" },
        data: expect.objectContaining({ end_date: null }),
      }),
    );
    const noteCall = db.pendingDescriptions.update.mock.calls.find(([arg]) => arg.data.note);
    expect(JSON.parse(noteCall?.[0].data.note)).toEqual({
      kind: "editDef",
      opredId: "20",
      endDateChanged: true,
      tags: [7],
    });
  });

  it("does not turn an unchanged blank date in an older card into an expiry removal", async () => {
    db.pendingWords.findUnique.mockResolvedValue(pending());
    db.pendingDescriptions.findMany.mockResolvedValue([{ id: 2n, end_date: null }]);
    const data = form();
    data.set("desc_end_2", "");
    await savePendingAction(data);
    for (const [args] of db.pendingDescriptions.update.mock.calls) expect(args.data).not.toHaveProperty("note");
  });

  it("does not let an editor use an owned card to edit a foreign description", async () => {
    vi.mocked(hasPermissionAsync).mockResolvedValue(false);
    setAuthed({ id: "17", role: "EDITOR" });
    db.pendingWords.findUnique.mockResolvedValue({ ...pending(), createBy: 17 });
    db.pendingDescriptions.findMany.mockResolvedValue([]);
    const data = form();
    data.set("desc_text_999", "Подмена");
    await expect(savePendingAction(data)).rejects.toMatchObject({ status: 403 });
    expect(db.pendingDescriptions.update).not.toHaveBeenCalled();
  });

  it.each([
    true,
    false,
  ])("only clears an existing expiry when the pending card explicitly requests it (%s)", async (explicit) => {
    db.pendingWords.findUnique.mockResolvedValue({
      ...pending(),
      descriptions: [
        {
          id: 2n,
          description: "Растение",
          difficulty: 1,
          end_date: null,
          note: JSON.stringify({ kind: "editDef", opredId: "20", ...(explicit ? { endDateChanged: true } : {}) }),
        },
      ],
    });
    await approvePendingAction(form());
    const data = db.opred_v.update.mock.calls[0][0].data;
    if (explicit) expect(data).toHaveProperty("end_date", null);
    else expect(data).not.toHaveProperty("end_date");
  });
});
