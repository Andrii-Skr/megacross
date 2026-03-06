import path from "node:path";
import type { Slot } from "../types.js";
import type { Dict, SolveOptions } from "./solver.js";

type NativeSolveOptions = {
  shuffle?: boolean;
  lcv?: boolean;
  lcvPrioritySlack?: number;
  restarts?: number;
  parallelRestarts?: number;
  uniqueWords?: boolean;
  splitComponents?: boolean;
  maxMs?: number;
  maxNodes?: number;
  logEveryMs?: number;
  logEveryNodes?: number;
  label?: string;
  debugDlx?: boolean;
  progressStdout?: boolean;
  failStdout?: boolean;
  wordPriority?: Record<string, number>;
};

type NativeModule = {
  solve_dlx?: (inputJson: string, progress?: (payload: unknown) => void) => string[] | null;
  solveDlx?: (inputJson: string, progress?: (payload: unknown) => void) => string[] | null;
  solve_dlx_async?: (inputJson: string, progress?: (payload: unknown) => void) => Promise<string[] | null>;
  solveDlxAsync?: (inputJson: string, progress?: (payload: unknown) => void) => Promise<string[] | null>;
  solve_csp?: (inputJson: string, progress?: (payload: unknown) => void) => string[] | null;
  solveCsp?: (inputJson: string, progress?: (payload: unknown) => void) => string[] | null;
  solve_csp_async?: (inputJson: string, progress?: (payload: unknown) => void) => Promise<string[] | null>;
  solveCspAsync?: (inputJson: string, progress?: (payload: unknown) => void) => Promise<string[] | null>;
};

let nativeModule: NativeModule | null | undefined;
let nativeModulePath: string | null | undefined;
let loggedLoaded = false;
let loggedMissing = false;
let loggedCallError = false;
let loggedAsyncMissing = false;
let loggedAsyncError = false;
let loggedCspCallError = false;
let loggedCspAsyncMissing = false;
let loggedCspAsyncError = false;
let lastTriedPaths: string[] | null = null;
let lastFail: Parameters<NonNullable<SolveOptions["onFail"]>>[0] | null = null;

function logLoadedNativeModuleOnce(): void {
  if (loggedLoaded) return;
  console.log(`[native-solver] loaded native module from ${nativeModulePath ?? "unknown path"}`);
  loggedLoaded = true;
}

function serializeWordPriority(priority?: Map<string, number>): Record<string, number> | undefined {
  if (!priority?.size) return undefined;
  const out: Record<string, number> = {};
  for (const [word, scoreRaw] of priority) {
    if (!word) continue;
    const score = Number(scoreRaw);
    if (!Number.isFinite(score)) continue;
    out[word] = Math.trunc(score);
  }
  return Object.keys(out).length ? out : undefined;
}

export function consumeLastNativeFail():
  | Parameters<NonNullable<SolveOptions["onFail"]>>[0]
  | null {
  const out = lastFail;
  lastFail = null;
  return out;
}

function loadNative(): NativeModule | null {
  if (nativeModule !== undefined) return nativeModule;
  const candidates = [
    process.env.DLX_NATIVE_PATH,
    path.join(__dirname, "../../native/dlx-solver/index.node"),
    path.join(__dirname, "../../native/dlx-solver/dlx_solver.node"),
  ].filter(Boolean) as string[];
  lastTriedPaths = candidates;

  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      nativeModule = require(p) as NativeModule;
      nativeModulePath = p;
      return nativeModule;
    } catch {
      // try next
    }
  }
  nativeModule = null;
  nativeModulePath = null;
  return null;
}

export function isNativeDlxAvailable(): boolean {
  return loadNative() !== null;
}

export function isNativeCspAvailable(): boolean {
  const native = loadNative();
  if (!native) return false;
  return !!(native.solve_csp ?? native.solveCsp);
}

export function solveDlxNative(
  rawRows: string[],
  slots: Slot[],
  dict: Dict,
  options?: SolveOptions
): string[] | null | undefined {
  lastFail = null;
  const native = loadNative();
  if (!native) {
    if (!loggedMissing) {
      const tried = lastTriedPaths?.length ? lastTriedPaths.join(", ") : "(none)";
      console.warn(`[native-dlx] not found. tried: ${tried}`);
      loggedMissing = true;
    }
    return undefined;
  }
  logLoadedNativeModuleOnce();
  const solveFn = native.solve_dlx ?? native.solveDlx;
  if (!solveFn) {
    if (!loggedCallError) {
      const keys = Object.keys(native);
      console.warn(`[native-dlx] missing solve function. exports: ${keys.join(", ") || "(none)"}`);
      loggedCallError = true;
    }
    return undefined;
  }
  const onProgress = options?.onProgress;
  const onFail = options?.onFail;
  let progressSeen = false;
  const progressWrapper = onProgress || onFail
    ? (payloadOrErr: unknown, payloadMaybe?: unknown) => {
        try {
          // TSFN path sends Node-style callback args: (err, payload).
          const payload = payloadMaybe ?? payloadOrErr;
          const data = typeof payload === "string" ? JSON.parse(payload) : payload;
          if (data && typeof data === "object") {
            if (!progressSeen) {
              progressSeen = true;
              if (options?.debugDlx) {
                console.log("[native-dlx] progress callback fired");
              }
            }
            if ((data as { type?: string }).type === "fail") {
              lastFail = data as Parameters<NonNullable<SolveOptions["onFail"]>>[0];
              onFail?.(lastFail);
              return;
            }
            onProgress?.(data as Parameters<NonNullable<SolveOptions["onProgress"]>>[0]);
          }
        } catch {
          // ignore malformed progress payloads
        }
      }
    : undefined;

  const dictObj: Record<string, string[]> = {};
  for (const [len, words] of dict) dictObj[String(len)] = words;
  const wordPriorityObj = serializeWordPriority(options?.wordPriority);

  const input = {
    rows: rawRows,
    slots: slots.map((s) => ({ id: s.id, len: s.len, cells: s.cells })),
    dict: dictObj,
    options: {
      shuffle: options?.shuffle,
      lcv: options?.lcv,
      lcvPrioritySlack: options?.lcvPrioritySlack,
      restarts: options?.restarts,
      parallelRestarts: options?.parallelRestarts,
      uniqueWords: options?.uniqueWords,
      splitComponents: options?.splitComponents,
      maxMs: options?.maxMs,
      maxNodes: options?.maxNodes,
      logEveryMs: options?.logEveryMs,
      logEveryNodes: options?.logEveryNodes,
      label: options?.label,
      debugDlx: options?.debugDlx,
      progressStdout: options?.progressStdout,
      failStdout: options?.failStdout,
      wordPriority: wordPriorityObj,
    } satisfies NativeSolveOptions,
  };

  try {
    const result = solveFn(JSON.stringify(input), progressWrapper);
    if (options?.debugDlx && onProgress && !progressSeen) {
      console.warn(
        `[native-dlx] progress callback never fired (logEveryMs=${options?.logEveryMs ?? 0} logEveryNodes=${options?.logEveryNodes ?? 0})`
      );
    }
    return result;
  } catch (err) {
    if (!loggedCallError) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[native-dlx] call failed. ${msg}`);
      loggedCallError = true;
    }
    return undefined;
  }
}

export function solveCspNative(
  rawRows: string[],
  slots: Slot[],
  dict: Dict,
  options?: SolveOptions
): string[] | null | undefined {
  lastFail = null;
  const native = loadNative();
  if (!native) {
    if (!loggedMissing) {
      const tried = lastTriedPaths?.length ? lastTriedPaths.join(", ") : "(none)";
      console.warn(`[native-csp] not found. tried: ${tried}`);
      loggedMissing = true;
    }
    return undefined;
  }
  logLoadedNativeModuleOnce();
  const solveFn = native.solve_csp ?? native.solveCsp;
  if (!solveFn) {
    if (!loggedCspCallError) {
      const keys = Object.keys(native);
      console.warn(`[native-csp] missing solve function. exports: ${keys.join(", ") || "(none)"}`);
      loggedCspCallError = true;
    }
    return undefined;
  }

  const onProgress = options?.onProgress;
  const onFail = options?.onFail;
  let progressSeen = false;
  const progressWrapper = onProgress || onFail
    ? (payloadOrErr: unknown, payloadMaybe?: unknown) => {
        try {
          const payload = payloadMaybe ?? payloadOrErr;
          const data = typeof payload === "string" ? JSON.parse(payload) : payload;
          if (data && typeof data === "object") {
            if (!progressSeen) {
              progressSeen = true;
              if (options?.debugDlx) {
                console.log("[native-csp] progress callback fired");
              }
            }
            if ((data as { type?: string }).type === "fail") {
              lastFail = data as Parameters<NonNullable<SolveOptions["onFail"]>>[0];
              onFail?.(lastFail);
              return;
            }
            onProgress?.(data as Parameters<NonNullable<SolveOptions["onProgress"]>>[0]);
          }
        } catch {
          // ignore malformed progress payloads
        }
      }
    : undefined;

  const dictObj: Record<string, string[]> = {};
  for (const [len, words] of dict) dictObj[String(len)] = words;
  const wordPriorityObj = serializeWordPriority(options?.wordPriority);
  const input = {
    rows: rawRows,
    slots: slots.map((s) => ({ id: s.id, len: s.len, cells: s.cells })),
    dict: dictObj,
    options: {
      shuffle: options?.shuffle,
      lcv: options?.lcv,
      lcvPrioritySlack: options?.lcvPrioritySlack,
      restarts: options?.restarts,
      parallelRestarts: options?.parallelRestarts,
      uniqueWords: options?.uniqueWords,
      splitComponents: options?.splitComponents,
      maxMs: options?.maxMs,
      maxNodes: options?.maxNodes,
      logEveryMs: options?.logEveryMs,
      logEveryNodes: options?.logEveryNodes,
      label: options?.label,
      debugDlx: options?.debugDlx,
      progressStdout: options?.progressStdout,
      failStdout: options?.failStdout,
      wordPriority: wordPriorityObj,
    } satisfies NativeSolveOptions,
  };

  try {
    const result = solveFn(JSON.stringify(input), progressWrapper);
    if (options?.debugDlx && onProgress && !progressSeen) {
      console.warn(
        `[native-csp] progress callback never fired (logEveryMs=${options?.logEveryMs ?? 0} logEveryNodes=${options?.logEveryNodes ?? 0})`
      );
    }
    return result;
  } catch (err) {
    if (!loggedCspCallError) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[native-csp] call failed. ${msg}`);
      loggedCspCallError = true;
    }
    return undefined;
  }
}

export async function solveDlxNativeAsync(
  rawRows: string[],
  slots: Slot[],
  dict: Dict,
  options?: SolveOptions
): Promise<string[] | null | undefined> {
  lastFail = null;
  const native = loadNative();
  if (!native) {
    if (!loggedMissing) {
      const tried = lastTriedPaths?.length ? lastTriedPaths.join(", ") : "(none)";
      console.warn(`[native-dlx] not found. tried: ${tried}`);
      loggedMissing = true;
    }
    return undefined;
  }
  logLoadedNativeModuleOnce();
  const solveAsync = native.solve_dlx_async ?? native.solveDlxAsync;
  if (!solveAsync) {
    if (!loggedAsyncMissing) {
      const keys = Object.keys(native);
      console.warn(`[native-dlx] missing async solve function. exports: ${keys.join(", ") || "(none)"}`);
      loggedAsyncMissing = true;
    }
    return undefined;
  }

  const onProgress = options?.onProgress;
  const onFail = options?.onFail;
  let progressSeen = false;
  const progressWrapper = onProgress || onFail
    ? (payloadOrErr: unknown, payloadMaybe?: unknown) => {
        try {
          // TSFN path sends Node-style callback args: (err, payload).
          const payload = payloadMaybe ?? payloadOrErr;
          const data = typeof payload === "string" ? JSON.parse(payload) : payload;
          if (data && typeof data === "object") {
            if (!progressSeen) {
              progressSeen = true;
              if (options?.debugDlx) {
                console.log("[native-dlx] progress callback fired");
              }
            }
            if ((data as { type?: string }).type === "fail") {
              lastFail = data as Parameters<NonNullable<SolveOptions["onFail"]>>[0];
              onFail?.(lastFail);
              return;
            }
            onProgress?.(data as Parameters<NonNullable<SolveOptions["onProgress"]>>[0]);
          }
        } catch {
          // ignore malformed progress payloads
        }
      }
    : undefined;

  const dictObj: Record<string, string[]> = {};
  for (const [len, words] of dict) dictObj[String(len)] = words;
  const wordPriorityObj = serializeWordPriority(options?.wordPriority);

  const input = {
    rows: rawRows,
    slots: slots.map((s) => ({ id: s.id, len: s.len, cells: s.cells })),
    dict: dictObj,
    options: {
      shuffle: options?.shuffle,
      lcv: options?.lcv,
      lcvPrioritySlack: options?.lcvPrioritySlack,
      restarts: options?.restarts,
      parallelRestarts: options?.parallelRestarts,
      uniqueWords: options?.uniqueWords,
      splitComponents: options?.splitComponents,
      maxMs: options?.maxMs,
      maxNodes: options?.maxNodes,
      logEveryMs: options?.logEveryMs,
      logEveryNodes: options?.logEveryNodes,
      label: options?.label,
      debugDlx: options?.debugDlx,
      progressStdout: options?.progressStdout,
      failStdout: options?.failStdout,
      wordPriority: wordPriorityObj,
    } satisfies NativeSolveOptions,
  };

  try {
    const result = await solveAsync(JSON.stringify(input), progressWrapper);
    if (options?.debugDlx && onProgress && !progressSeen) {
      console.warn(
        `[native-dlx] progress callback never fired (logEveryMs=${options?.logEveryMs ?? 0} logEveryNodes=${options?.logEveryNodes ?? 0})`
      );
    }
    return result;
  } catch (err) {
    if (!loggedAsyncError) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[native-dlx] async call failed. ${msg}`);
      loggedAsyncError = true;
    }
    return undefined;
  }
}

export async function solveCspNativeAsync(
  rawRows: string[],
  slots: Slot[],
  dict: Dict,
  options?: SolveOptions
): Promise<string[] | null | undefined> {
  lastFail = null;
  const native = loadNative();
  if (!native) {
    if (!loggedMissing) {
      const tried = lastTriedPaths?.length ? lastTriedPaths.join(", ") : "(none)";
      console.warn(`[native-csp] not found. tried: ${tried}`);
      loggedMissing = true;
    }
    return undefined;
  }
  logLoadedNativeModuleOnce();
  const solveAsync = native.solve_csp_async ?? native.solveCspAsync;
  if (!solveAsync) {
    if (!loggedCspAsyncMissing) {
      const keys = Object.keys(native);
      console.warn(`[native-csp] missing async solve function. exports: ${keys.join(", ") || "(none)"}`);
      loggedCspAsyncMissing = true;
    }
    return undefined;
  }

  const onProgress = options?.onProgress;
  const onFail = options?.onFail;
  let progressSeen = false;
  const progressWrapper = onProgress || onFail
    ? (payloadOrErr: unknown, payloadMaybe?: unknown) => {
        try {
          const payload = payloadMaybe ?? payloadOrErr;
          const data = typeof payload === "string" ? JSON.parse(payload) : payload;
          if (data && typeof data === "object") {
            if (!progressSeen) {
              progressSeen = true;
              if (options?.debugDlx) {
                console.log("[native-csp] progress callback fired");
              }
            }
            if ((data as { type?: string }).type === "fail") {
              lastFail = data as Parameters<NonNullable<SolveOptions["onFail"]>>[0];
              onFail?.(lastFail);
              return;
            }
            onProgress?.(data as Parameters<NonNullable<SolveOptions["onProgress"]>>[0]);
          }
        } catch {
          // ignore malformed progress payloads
        }
      }
    : undefined;

  const dictObj: Record<string, string[]> = {};
  for (const [len, words] of dict) dictObj[String(len)] = words;
  const wordPriorityObj = serializeWordPriority(options?.wordPriority);

  const input = {
    rows: rawRows,
    slots: slots.map((s) => ({ id: s.id, len: s.len, cells: s.cells })),
    dict: dictObj,
    options: {
      shuffle: options?.shuffle,
      lcv: options?.lcv,
      lcvPrioritySlack: options?.lcvPrioritySlack,
      restarts: options?.restarts,
      parallelRestarts: options?.parallelRestarts,
      uniqueWords: options?.uniqueWords,
      splitComponents: options?.splitComponents,
      maxMs: options?.maxMs,
      maxNodes: options?.maxNodes,
      logEveryMs: options?.logEveryMs,
      logEveryNodes: options?.logEveryNodes,
      label: options?.label,
      debugDlx: options?.debugDlx,
      progressStdout: options?.progressStdout,
      failStdout: options?.failStdout,
      wordPriority: wordPriorityObj,
    } satisfies NativeSolveOptions,
  };

  try {
    const result = await solveAsync(JSON.stringify(input), progressWrapper);
    if (options?.debugDlx && onProgress && !progressSeen) {
      console.warn(
        `[native-csp] progress callback never fired (logEveryMs=${options?.logEveryMs ?? 0} logEveryNodes=${options?.logEveryNodes ?? 0})`
      );
    }
    return result;
  } catch (err) {
    if (!loggedCspAsyncError) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[native-csp] async call failed. ${msg}`);
      loggedCspAsyncError = true;
    }
    return undefined;
  }
}
