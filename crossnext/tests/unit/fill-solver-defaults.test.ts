import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIRS } from "../../../cross/server/src/types";
import { runDlxProbe, runSolverProbe } from "../../../cross/server/src/utils/fillFallback";
import {
  DEFAULT_FILL_SOLVER,
  fillSolverSearchProfile,
  resolveFillSolverEngine,
} from "../../../cross/server/src/utils/fillSolverProfile";
import { solve } from "../../../cross/server/src/utils/solver";

const native = vi.hoisted(() => ({ csp: vi.fn(() => ["КОТ"]), dlx: vi.fn(() => ["КОТ"]) }));
vi.mock("../../../cross/server/src/utils/nativeDlx", () => ({
  solveCspNative: native.csp,
  solveDlxNative: native.dlx,
}));
const slots = [
  {
    id: 0,
    r: 0,
    c: 0,
    dir: DIRS.right,
    len: 3,
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ] as [number, number][],
  },
];
const dict = new Map([[3, ["КОТ"]]]);

describe("default native fill profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to CSP and preserves explicit API/CLI DLX selection", () => {
    expect(DEFAULT_FILL_SOLVER).toBe("csp");
    expect(resolveFillSolverEngine()).toBe("csp");
    expect(resolveFillSolverEngine(undefined, { nativeDlx: true })).toBe("dlx");
    expect(resolveFillSolverEngine(undefined, { nativeDlx: true, nativeCsp: true })).toBe("csp");
    expect(resolveFillSolverEngine(" DLX ", { nativeCsp: true })).toBe("dlx");
    expect(resolveFillSolverEngine("csp", { nativeDlx: true })).toBe("csp");
  });

  it("enables MAC but retains score optimization for the main CSP search", () => {
    expect(fillSolverSearchProfile("csp")).toEqual({ strongPropagation: true, firstSolution: false });
    expect(fillSolverSearchProfile("csp", true)).toEqual({ strongPropagation: true, firstSolution: true });
    expect(fillSolverSearchProfile("dlx")).toEqual({ strongPropagation: false, firstSolution: false });
    solve(["..."], slots, dict);
    expect(native.csp).toHaveBeenCalledWith(
      ["..."],
      slots,
      dict,
      expect.objectContaining({ engine: "csp", strongPropagation: true, firstSolution: false, nativeDlx: true }),
    );
    expect(native.dlx).not.toHaveBeenCalled();
  });

  it("uses CSP+MAC in the default probe with unchanged probe budgets", () => {
    expect(runSolverProbe(["..."], slots, dict, { maxNodes: 200_000 }).outcome).toBe("solved");
    expect(native.csp).toHaveBeenCalledWith(
      ["..."],
      slots,
      dict,
      expect.objectContaining({
        engine: "csp",
        strongPropagation: true,
        firstSolution: true,
        shuffle: true,
        maxNodes: 40_000,
        maxMs: 1500,
      }),
    );
    expect(native.dlx).not.toHaveBeenCalled();
  });

  it("keeps both explicit DLX paths available", () => {
    solve(["..."], slots, dict, { engine: "dlx" });
    runDlxProbe(["..."], slots, dict);
    expect(native.dlx).toHaveBeenCalledTimes(2);
    expect(native.dlx).toHaveBeenLastCalledWith(
      ["..."],
      slots,
      dict,
      expect.objectContaining({ engine: "dlx", strongPropagation: false, firstSolution: true }),
    );
    expect(native.csp).not.toHaveBeenCalled();
  });

  it("honors disabling probe shuffle and forwards an explicit seed", () => {
    runSolverProbe(["..."], slots, dict, { shuffle: false, seed: 12345 });
    expect(native.csp).toHaveBeenLastCalledWith(
      ["..."],
      slots,
      dict,
      expect.objectContaining({ shuffle: false, seed: 12345 }),
    );
    runDlxProbe(["..."], slots, dict);
    expect(native.dlx).toHaveBeenLastCalledWith(["..."], slots, dict, expect.objectContaining({ shuffle: false }));
    runSolverProbe(["..."], slots, dict, { engine: "dlx", shuffle: true });
    expect(native.dlx).toHaveBeenLastCalledWith(["..."], slots, dict, expect.objectContaining({ shuffle: false }));
  });

  it("does not disable MAC when an optional setting is undefined", () => {
    solve(["..."], slots, dict, { strongPropagation: undefined });
    expect(native.csp).toHaveBeenLastCalledWith(
      ["..."],
      slots,
      dict,
      expect.objectContaining({ strongPropagation: true }),
    );
    solve(["..."], slots, dict, { strongPropagation: false });
    expect(native.csp).toHaveBeenLastCalledWith(
      ["..."],
      slots,
      dict,
      expect.objectContaining({ strongPropagation: false }),
    );
  });
});
