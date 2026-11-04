import { createHash } from "node:crypto";
import path from "node:path";

export class InvalidStorageNameError extends Error {
  constructor() {
    super("INVALID_STORAGE_NAME");
  }
}

export function sanitizeStorageName(name: string): string {
  const base = path.basename(name).replace(/[\r\n\t]/g, " ").trim().normalize("NFC");
  const safe = base
    .replace(/[^\p{L}\p{N}\p{M}\-_. ]+/gu, "_")
    .replace(/_{2,}/g, "_")
    .replace(/ {2,}/g, " ");
  if (!safe || safe === "." || safe === "..") throw new InvalidStorageNameError();
  return safe;
}

export function isValidStorageName(name: string): boolean {
  try {
    sanitizeStorageName(name);
    return true;
  } catch {
    return false;
  }
}

export function resolveStorageChild(root: string, ...names: string[]): string {
  const resolvedRoot = path.resolve(root);
  const child = path.resolve(resolvedRoot, ...names.map(sanitizeStorageName));
  const relative = path.relative(resolvedRoot, child);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new InvalidStorageNameError();
  }
  return child;
}

/** Keep canonical legacy directories; changed names use a separate, collision-resistant namespace. */
export function resolveIssueStorageDirectory(root: string, editionCode: string, issueLabel: string): string {
  const directoryKey = (name: string) => {
    const safe = sanitizeStorageName(name);
    // The old sanitizer never emitted '~', so encoded and legacy keys cannot overlap.
    return safe === name ? safe : `~${createHash("sha256").update(name).digest("hex")}`;
  };
  return path.resolve(root, directoryKey(editionCode), directoryKey(issueLabel));
}
