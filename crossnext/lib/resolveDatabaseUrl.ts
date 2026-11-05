import fs from "node:fs";
import path from "node:path";
import { buildPostgresUrl } from "@megacross/cross-format/postgres-url";

function readSecretFile(secretPath: string | undefined): string | null {
  if (!secretPath) return null;

  const candidate = path.isAbsolute(secretPath)
    ? secretPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), secretPath);

  try {
    const value = fs.readFileSync(/* turbopackIgnore: true */ candidate, "utf8").replace(/[\r\n]+$/u, "");
    return value || null;
  } catch {
    return null;
  }
}

function getPostgresPassword() {
  return (
    process.env.POSTGRES_PASSWORD ||
    readSecretFile(process.env.POSTGRES_PASSWORD_FILE) ||
    readSecretFile("/run/secrets/postgres_password") ||
    readSecretFile("secrets/postgres_password")
  );
}

function buildUrlFromPostgresEnv() {
  const user = process.env.POSTGRES_USER?.trim();
  const dbName = process.env.POSTGRES_DB?.trim();
  if (!user || !dbName) return null;

  const host = process.env.POSTGRES_HOST?.trim() || "localhost";
  const port = process.env.POSTGRES_PORT?.trim() || "5432";
  const password = getPostgresPassword();
  return buildPostgresUrl({ user, password, host, port, database: dbName });
}

export function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.DATABASE_URL_DEV ??
    buildUrlFromPostgresEnv() ??
    process.env.PRISMA_FALLBACK_URL ??
    null
  );
}
