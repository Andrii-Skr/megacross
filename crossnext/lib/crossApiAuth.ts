import { createHmac } from "node:crypto";

// Scope the service credential so the NextAuth signing secret never leaves this process.
export function crossApiHeaders(input?: HeadersInit): Headers {
  const secret = process.env.CROSS_API_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("Cross API authentication is not configured");
  const token = createHmac("sha256", secret).update("megacross:cross-api:v1").digest("hex");
  const headers = new Headers(input);
  headers.set("authorization", `Bearer ${token}`);
  return headers;
}
