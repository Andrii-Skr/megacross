import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

export { Prisma } from "../../generated/prisma/client";
export type { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const moduleDir = dirname(fileURLToPath(import.meta.url));
const serverRootDir = resolve(moduleDir, "../..");

// Prisma client can be imported from scripts started with different cwd values.
// Load env both from current cwd and explicitly from server/.env.
loadDotenv({ quiet: true });
loadDotenv({ path: resolve(serverRootDir, ".env"), override: false, quiet: true });

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      `DATABASE_URL is not set. Define it in process env or in ${resolve(serverRootDir, ".env")}`
    );
  }
  return url;
}

export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: resolveDatabaseUrl(),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
