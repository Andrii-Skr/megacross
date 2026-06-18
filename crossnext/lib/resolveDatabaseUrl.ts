import fs from "node:fs";
import path from "node:path";

function readSecretFile(secretPath: string | undefined): string | null {
  if (!secretPath) return null;

  const candidate = path.isAbsolute(secretPath) ? secretPath : path.join(process.cwd(), secretPath);

  try {
    const value = fs.readFileSync(candidate, "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

function getPostgresPassword() {
  return (
    process.env.POSTGRES_PASSWORD?.trim() ||
    readSecretFile(process.env.POSTGRES_PASSWORD_FILE) ||
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
  const auth = password ? `${user}:${password}` : user;

  return `postgresql://${auth}@${host}:${port}/${dbName}?schema=public`;
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

