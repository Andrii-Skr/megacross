import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateUserAction } from "@/app/actions/admin";
import { setAuthed } from "../mocks";

const { db, hash } = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn(), update: vi.fn() }, roleDb: { findMany: vi.fn(), upsert: vi.fn() } },
  hash: vi.fn(async () => "new-password-hash"),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/authz", () => ({
  Permissions: { AdminAccess: "admin:access" },
  requirePermissionAsync: vi.fn(async () => undefined),
}));
vi.mock("bcrypt", () => ({ hash }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "ru" }));

function form(role?: string) {
  const data = new FormData();
  data.set("id", "99");
  data.set("password", "StrongPass123!");
  if (role) data.set("role", role);
  return data;
}

describe("user management target permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthed({ id: "17", role: "CHIEF_EDITOR_PLUS" });
    db.roleDb.findMany.mockResolvedValue(
      ["ADMIN", "CHIEF_EDITOR_PLUS", "CHIEF_EDITOR", "EDITOR", "MANAGER", "USER"].map((code) => ({ code })),
    );
  });

  it.each([
    undefined,
    "CHIEF_EDITOR_PLUS",
    "EDITOR",
  ])("cannot change a peer's password or demote them (requested role %s)", async (role) => {
    db.user.findUnique.mockResolvedValue({ role: { code: "CHIEF_EDITOR_PLUS" } });
    await expect(updateUserAction(form(role))).rejects.toMatchObject({ status: 403 });
    expect(hash).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.roleDb.upsert).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "MANAGER"])("cannot change a protected %s account", async (code) => {
    db.user.findUnique.mockResolvedValue({ role: { code } });
    await expect(updateUserAction(form())).rejects.toMatchObject({ status: 403 });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "CHIEF_EDITOR_PLUS"])("allows %s to reset a managed editor's password", async (role) => {
    setAuthed({ id: "17", role });
    db.user.findUnique.mockResolvedValue({ role: { code: "EDITOR" } });
    await updateUserAction(form());
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 99 }, data: { passwordHash: "new-password-hash" } });
  });

  it("allows ADMIN to manage CHIEF_EDITOR_PLUS", async () => {
    setAuthed({ id: "17", role: "ADMIN" });
    db.user.findUnique.mockResolvedValue({ role: { code: "CHIEF_EDITOR_PLUS" } });
    await updateUserAction(form());
    expect(db.user.update).toHaveBeenCalled();
  });
});
