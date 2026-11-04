import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { parse } from "dotenv";
import { Client } from "pg";
import { z } from "zod";
import { resolveDatabaseUrl } from "../lib/resolveDatabaseUrl";
import { buildCombinedWordImageImportSql, buildWordImageFlagsImportSql } from "../lib/wordImageTransfer";

async function main() {
  const { values } = parseArgs({
    options: { out: { type: "string" }, "word-flags": { type: "boolean" }, help: { type: "boolean" } },
    strict: true,
  });
  if (values.help) {
    console.log(
      "Usage: pnpm images:export --out ../output/imagegen/word-images-export.sql\nExports images and all word_v image flags together. Use --word-flags for flags only. Exports metadata only; copy word-images/ separately. This command never writes to the source DB.",
    );
    return;
  }
  const out = path.resolve(z.string().min(1).parse(values.out));
  const readEnv = async (name: string) => {
    try {
      return parse(await readFile(name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  };
  const settings = { ...(await readEnv(".env")), ...(await readEnv(".env.local")) };
  for (const [key, value] of Object.entries(settings)) process.env[key] ??= value;
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) throw new Error("Configure DATABASE_URL before exporting");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    // Both datasets must describe the same source snapshot.
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const flags = (
      await client.query(`
      SELECT w.id::text AS "wordId", w.word_text AS word, l.code AS language, w."isImageable",
        to_char(w."imageGeneratedAt", 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "imageGeneratedAt"
      FROM word_v w JOIN language l ON l.id = w."langId"
      WHERE w."isImageable" = true OR w."imageGeneratedAt" IS NOT NULL
      ORDER BY w.id
    `)
    ).rows;
    const images = values["word-flags"]
      ? []
      : (
          await client.query(`
      SELECT i."wordId"::text, w.word_text AS word, l.code AS language,
        to_char(w."imageGeneratedAt", 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "imageGeneratedAt", i."fileName", i."mimeType", i."storageRelPath",
        i.sha256, i."sizeBytes"::text, i.width, i.height, i."aspectRatio"::text,
        i."needsReview",
        to_char(i."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
        to_char(i."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
      FROM scanword_word_images i
      JOIN word_v w ON w.id = i."wordId"
      JOIN language l ON l.id = w."langId"
      ORDER BY i.id
    `)
        ).rows;
    const sql = values["word-flags"]
      ? buildWordImageFlagsImportSql(flags)
      : buildCombinedWordImageImportSql(images, flags);
    await client.query("COMMIT");
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, sql, { flag: "wx", mode: 0o600 });
    console.log(
      JSON.stringify(
        {
          file: out,
          images: values["word-flags"] ? undefined : images.length,
          words: new Set([...flags, ...images].map((row) => row.wordId)).size,
          bytes: Buffer.byteLength(sql),
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // Avoid dumping a connection URL or the image export contents on errors.
  console.error(
    error instanceof z.ZodError
      ? "Export validation failed; check image metadata"
      : error.code === "EEXIST"
        ? "Output file already exists; choose a new --out path"
        : "Word image export failed; check database access and schema migrations",
  );
  process.exitCode = 1;
});
