import { link, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const appends = new Map<string, Promise<void>>();

/** Publish complete files without overwriting existing ones; roll back if persistence fails. */
export async function appendTemplateFiles<T>(
  directory: string,
  files: Array<{ stem: string; bytes: Uint8Array }>,
  persist: (written: string[]) => Promise<T>,
): Promise<T> {
  const key = path.resolve(directory);
  const previous = appends.get(key) ?? Promise.resolve();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  appends.set(key, pending);
  await previous;
  const written: string[] = [];
  let staging: string | undefined;
  try {
    await mkdir(directory, { recursive: true });
    staging = await mkdtemp(path.join(directory, ".append-"));
    for (const [index, file] of files.entries()) {
      const temporary = path.join(staging, String(index));
      const bytes = Buffer.from(file.bytes);
      await writeFile(temporary, bytes);
      let suffix = 1;
      for (;;) {
        const name = `${file.stem}${suffix === 1 ? "" : `_${suffix}`}.fsh`;
        const target = path.join(directory, name);
        try {
          // A hard link publishes the fully written file and fails rather than overwriting.
          await link(temporary, target);
          written.push(name);
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          // Repeating a successful request reuses its file, including legacy suffixed names.
          if ((await readFile(target)).equals(bytes)) break;
          suffix += 1;
        }
      }
    }
    return await persist(written);
  } catch (error) {
    const cleanup = await Promise.allSettled(written.map((name) => unlink(path.join(directory, name))));
    const failures = cleanup.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length) throw new AggregateError([error, ...failures.map((result) => result.reason)], "Failed to roll back appended templates");
    throw error;
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true }).catch((error) => {
      console.warn("Failed to remove template append staging directory", error);
    });
    release();
    if (appends.get(key) === pending) appends.delete(key);
  }
}
