import fs from "node:fs/promises";
import path from "node:path";

/** Populate a sibling directory first, then publish it, restoring the old directory on errors. */
export async function replaceDirectory<T>(destination: string, populate: (staging: string) => Promise<T>): Promise<T> {
  const parent = path.dirname(destination);
  await fs.mkdir(parent, { recursive: true });
  const staging = await fs.mkdtemp(path.join(parent, ".upload-"));
  const backup = `${staging}.previous`;
  let movedPrevious = false;
  let published = false;
  try {
    const result = await populate(staging);
    try {
      await fs.rename(destination, backup);
      movedPrevious = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      await fs.rename(staging, destination);
      published = true;
    } catch (error) {
      if (movedPrevious) {
        // Never delete the backup when restoration fails: it is still the recoverable original.
        await fs.rename(backup, destination);
        movedPrevious = false;
      }
      throw error;
    }
    return result;
  } finally {
    if (!published) await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    if (published && movedPrevious) {
      await fs.rm(backup, { recursive: true, force: true }).catch((error) => {
        console.warn("Failed to remove previous upload directory", error);
      });
    }
  }
}
