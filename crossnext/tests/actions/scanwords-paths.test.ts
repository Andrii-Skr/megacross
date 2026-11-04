import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIssueAction } from "@/app/actions/scanwords";
import { setAuthed } from "../mocks";

const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { issueNumber: { upsert } } }));
vi.mock("@/lib/authz", () => ({
  Permissions: { AdminAccess: "admin:access" },
  requirePermissionAsync: vi.fn(async () => undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "ru" }));

describe("issue storage label validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthed({ id: "17", role: "ADMIN" });
  });

  it.each([
    "..",
    ".",
    "/",
    "folder/..",
    "   ",
  ])("rejects unsafe label %j before writing to the database", async (label) => {
    await expect(createIssueAction({ editionId: 1, label })).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
});
