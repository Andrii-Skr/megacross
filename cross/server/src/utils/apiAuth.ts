import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { RequestHandler } from "express";

export function serviceApiAuth(secret: string | undefined): RequestHandler {
  const expected = secret?.trim()
    ? Buffer.from(`Bearer ${createHmac("sha256", secret.trim()).update("megacross:cross-api:v1").digest("hex")}`)
    : null;
  return (req, res, next) => {
    if (req.method === "GET" && req.path === "/api/healthz") return next();
    if (!expected) {
      res.status(503).json({ error: "Cross API authentication is not configured" });
      return;
    }
    const supplied = Buffer.from(req.get("authorization") ?? "");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}

export function resolveApiSecret(): string | undefined {
  const configured = process.env.CROSS_API_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (configured) return configured;
  const file = "/run/secrets/nextauth_secret";
  return existsSync(file) ? readFileSync(file, "utf8").trim() : undefined;
}
