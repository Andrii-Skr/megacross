import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { prisma, type Prisma } from "../src/db/prisma";

type GeneratedItem = {
  wordId: string;
  word: string;
  generatedAt: string;
  files: Record<string, string>;
};
type GeneratedManifest = { variants: Record<string, unknown>; items: GeneratedItem[] };

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

async function readCompletedManifest(file: string): Promise<GeneratedItem[]> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as GeneratedManifest;
  if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length || !parsed.variants || typeof parsed.variants !== "object") {
    throw new Error("Expected a generated-image manifest with items and variants");
  }
  const variants = Object.keys(parsed.variants);
  if (!variants.length) throw new Error("The manifest has no planned variants");
  const seen = new Set<string>();
  for (const item of parsed.items) {
    if (!item || typeof item.wordId !== "string" || !/^\d+$/.test(item.wordId) || typeof item.word !== "string" || !item.word ||
        typeof item.generatedAt !== "string" || !Number.isFinite(Date.parse(item.generatedAt)) || !item.files || typeof item.files !== "object") {
      throw new Error("Every word must have an ID, text, generation date and completed files");
    }
    const id = BigInt(item.wordId).toString();
    if (seen.has(id)) throw new Error(`Duplicate word ID: ${id}`);
    seen.add(id);
    for (const variant of variants) {
      const name = item.files[variant];
      if (typeof name !== "string" || !name || isAbsolute(name)) throw new Error(`Missing relative ${variant} file for ${item.word}`);
      const image = resolve(dirname(file), name);
      const rel = relative(dirname(file), image);
      if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) throw new Error("Image paths must stay inside the batch folder");
      const metadata = await stat(image);
      if (!metadata.isFile() || metadata.size === 0) throw new Error(`Incomplete image: ${image}`);
    }
  }
  return parsed.items;
}

async function listCandidates(language: string, limit: number, out: string): Promise<void> {
  const now = new Date();
  const definitionWhere: Prisma.opred_vWhereInput = {
    is_deleted: false,
    text_opr: { not: "" },
    language: { is: { code: language } },
    OR: [{ end_date: null }, { end_date: { gte: now } }],
  };
  const where: Prisma.word_vWhereInput = {
    is_deleted: false,
    isImageable: true,
    imageGeneratedAt: null,
    language: { is: { code: language } },
    opred_v: { some: definitionWhere },
  };
  const [words, eligibleRemaining] = await Promise.all([
    prisma.word_v.findMany({
      where,
      orderBy: { id: "asc" },
      take: limit,
      select: {
        id: true,
        word_text: true,
        opred_v: { where: definitionWhere, orderBy: [{ difficulty: "asc" }, { id: "asc" }], select: { id: true, text_opr: true } },
      },
    }),
    prisma.word_v.count({ where }),
  ]);
  const manifest = {
    version: 1,
    createdAt: now.toISOString(),
    language,
    selection: "isImageable=true, imageGeneratedAt=null, active word and definition; candidates only, not reserved or marked generated",
    variants: { square: [512, 512], landscape: [640, 512], portrait: [512, 640] },
    items: words.map((word, i) => ({
      index: i + 1,
      wordId: String(word.id),
      word: word.word_text,
      definitions: word.opred_v.map((definition) => ({ opredId: String(definition.id), text: definition.text_opr })),
      status: "pending",
    })),
  };
  await mkdir(dirname(out), { recursive: true });
  // Never overwrite an earlier batch or its generation history.
  await writeFile(out, JSON.stringify(manifest, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ selected: words.length, eligibleRemaining, output: out }));
}

async function markCompleted(file: string, apply: boolean): Promise<void> {
  const items = await readCompletedManifest(file);
  const result = await prisma.$transaction(async (tx) => {
    const words = await tx.word_v.findMany({
      where: { id: { in: items.map((item) => BigInt(item.wordId)) } },
      select: { id: true, word_text: true, is_deleted: true, imageGeneratedAt: true },
    });
    const byId = new Map(words.map((word) => [String(word.id), word]));
    for (const item of items) {
      const word = byId.get(BigInt(item.wordId).toString());
      if (!word || word.is_deleted || word.word_text !== item.word) throw new Error(`Word identity changed: ${item.word}`);
    }
    const pending = items.filter((item) => byId.get(BigInt(item.wordId).toString())?.imageGeneratedAt == null);
    let updated = 0;
    if (apply) {
      for (const item of pending) {
        const result = await tx.word_v.updateMany({
          where: { id: BigInt(item.wordId), imageGeneratedAt: null },
          data: { imageGeneratedAt: new Date(item.generatedAt) },
        });
        updated += result.count;
      }
    }
    return { words: items.length, alreadyMarked: items.length - pending.length, toMark: pending.length, updated, dryRun: !apply };
  }, { timeout: 30000 });
  console.log(JSON.stringify(result));
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      language: { type: "string", default: "ru" },
      limit: { type: "string", default: "100" },
      out: { type: "string" },
      manifest: { type: "string" },
      apply: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log("image-generation:candidates [--language ru] [--limit 100] [--out path.json]\nimage-generation:mark --manifest path/manifest.json [--apply]");
    return;
  }
  const command = positionals[0] ?? "list";
  if (positionals.length > 1) throw new Error("Unexpected positional arguments");
  if (command === "list") {
    if (values.apply || values.manifest) throw new Error("--apply/--manifest are only valid for mark");
    const limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("--limit must be an integer between 1 and 10000");
    const language = values.language.trim().toLowerCase();
    if (!language) throw new Error("--language is required");
    const out = values.out ? resolve(values.out) : resolve(repositoryRoot, "output/imagegen", `candidates-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await listCandidates(language, limit, out);
  } else if (command === "mark") {
    if (!values.manifest || values.out) throw new Error("mark requires --manifest and does not accept --out");
    await markCompleted(resolve(values.manifest), values.apply);
  } else {
    throw new Error("Expected list or mark");
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
