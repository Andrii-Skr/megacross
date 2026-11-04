import { beforeEach, expect, it, vi } from "vitest";
import { saveScanwordIssueSvgSettingsAction } from "@/app/actions/scanwords";

const { db } = vi.hoisted(() => ({ db: { $queryRaw: vi.fn(), $executeRaw: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/authz", () => ({ Permissions: { AdminAccess: "admin:access" }, requirePermissionAsync: vi.fn() }));
const input = {
  issueId: "1",
  clueFontBasePt: 10,
  clueFontMinPt: 6,
  clueGlyphWidthPct: 100,
  clueLineHeightPct: 100,
  fontId: "2",
};
beforeEach(() => vi.clearAllMocks());
it.each(["woff", "woff2"])("does not save a previously uploaded %s font as the issue's export font", async (format) => {
  db.$queryRaw.mockResolvedValueOnce([{ id: 2n, format }]);
  await expect(saveScanwordIssueSvgSettingsAction(input)).rejects.toMatchObject({
    code: "SVG_FONT_UNSUPPORTED_FORMAT",
    status: 400,
  });
  expect(db.$executeRaw).not.toHaveBeenCalled();
});
it.each(["ttf", "otf"])("allows selecting %s for EPS export", async (format) => {
  db.$queryRaw.mockResolvedValueOnce([{ id: 2n, format }]).mockResolvedValueOnce([{ ...input, fontId: 2n }]);
  expect((await saveScanwordIssueSvgSettingsAction(input)).fontId).toBe("2");
  expect(db.$executeRaw).toHaveBeenCalledOnce();
});
