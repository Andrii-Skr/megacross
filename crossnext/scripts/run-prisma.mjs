import { spawn } from "node:child_process";
import { access, lstat, readlink, realpath, rm, symlink } from "node:fs/promises";
import path from "node:path";

const MIN_NODE_VERSION = [20, 19, 0];

function parseVersion(raw) {
  const cleaned = raw.trim().replace(/^v/, "");
  const parts = cleaned.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return parts.slice(0, 3);
}

function compareVersions(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a - b;
  }
  return 0;
}

async function canUseNode(nodePath) {
  if (!nodePath) return null;
  try {
    await access(nodePath);
  } catch {
    return null;
  }

  const version = await new Promise((resolve) => {
    const child = spawn(nodePath, ["-p", "process.versions.node"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("close", (code) => {
      resolve(code === 0 ? stdout.trim() : null);
    });
    child.on("error", () => resolve(null));
  });

  if (!version) return null;
  const parsed = parseVersion(version);
  if (!parsed || compareVersions(parsed, MIN_NODE_VERSION) < 0) return null;
  return { nodePath, version };
}

async function resolveNodeBinary() {
  const candidates = [
    process.env.PRISMA_NODE_BINARY,
    process.execPath,
    "/opt/homebrew/opt/node@24/bin/node",
    "/opt/homebrew/opt/node@22/bin/node",
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = await canUseNode(candidate);
    if (match) return match;
  }

  return null;
}

async function ensurePrismaClientGeneratedLink() {
  const packageRoot = await realpath(path.join(process.cwd(), "node_modules", "@prisma", "client"));
  const generatedRoot = path.join(packageRoot, "..", "..", ".prisma");
  const localGeneratedLink = path.join(packageRoot, ".prisma");
  const relativeTarget = path.relative(packageRoot, generatedRoot);

  try {
    await access(path.join(generatedRoot, "client", "default.d.ts"));
  } catch {
    return;
  }

  try {
    const stat = await lstat(localGeneratedLink);
    if (stat.isSymbolicLink()) {
      const currentTarget = await readlink(localGeneratedLink);
      if (currentTarget === relativeTarget) return;
    }
    await rm(localGeneratedLink, { recursive: true, force: true });
  } catch {
    // link is absent, continue
  }

  await symlink(relativeTarget, localGeneratedLink, "dir");
}

async function main() {
  const resolved = await resolveNodeBinary();
  if (!resolved) {
    const current = process.versions.node;
    console.error(
      [
        `Prisma commands require Node >= ${MIN_NODE_VERSION.join(".")}.`,
        `Current node: ${current} (${process.execPath}).`,
        "Install a newer Node or set PRISMA_NODE_BINARY to a compatible node executable.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const prismaCliPath = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const args = process.argv.slice(2);
  const child = spawn(resolved.nodePath, [prismaCliPath, ...args], {
    stdio: "inherit",
    env: process.env,
  });

  const result = await new Promise((resolve) => {
    child.on("close", (code, signal) => resolve({ code, signal }));
    child.on("error", (error) => resolve({ code: 1, signal: null, error }));
  });

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }

  if ("error" in result) {
    console.error(`Failed to run Prisma CLI with ${resolved.nodePath}:`, result.error);
    process.exit(1);
    return;
  }

  if ((result.code ?? 1) === 0) {
    const command = args[0] ?? "";
    if (["generate", "db", "migrate"].includes(command)) {
      try {
        await ensurePrismaClientGeneratedLink();
      } catch (error) {
        console.error("Failed to finalize Prisma client links:", error);
        process.exit(1);
        return;
      }
    }
  }

  process.exit(result.code ?? 1);
}

await main();
