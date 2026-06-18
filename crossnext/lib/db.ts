import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "@/lib/resolveDatabaseUrl";

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

// Prefer DATABASE_URL (Next/Prisma default). Fallback to DATABASE_URL_DEV for local/dev, or to PRISMA_FALLBACK_URL
// when explicitly allowed (e.g., during Docker build).
const fallbackUrl = process.env.PRISMA_FALLBACK_URL ?? "postgresql://prisma:prisma@localhost:5432/prisma?schema=public";
const resolvedUrl = resolveDatabaseUrl();
const hasRealUrl = Boolean(resolvedUrl && resolvedUrl !== fallbackUrl);
const allowFallback = process.env.PRISMA_ALLOW_FALLBACK === "1";

if (!hasRealUrl && !allowFallback) {
  throw new Error("DATABASE_URL or DATABASE_URL_DEV must be set for Prisma.");
}

if (!hasRealUrl && allowFallback) {
  console.warn(
    "[prisma] DATABASE_URL not set. Using fallback PRISMA_FALLBACK_URL. Do not rely on this in production runtime.",
  );
}

const datasourceUrl = resolvedUrl ?? fallbackUrl;

if (!datasourceUrl) {
  throw new Error("Set DATABASE_URL or DATABASE_URL_DEV to configure Prisma adapter.");
}

const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: datasourceUrl })),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

export const prisma = globalThis.__PRISMA__ || createClient();

if (process.env.NODE_ENV !== "production") globalThis.__PRISMA__ = prisma;
