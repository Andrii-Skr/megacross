import { createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { serviceApiAuth } from "../../../cross/server/src/utils/apiAuth";

function request(secret: string | undefined, authorization?: string, path = "/api/fill/start") {
  const next = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  serviceApiAuth(secret)(
    { method: "GET", path, get: () => authorization } as unknown as Request,
    res as unknown as Response,
    next as NextFunction,
  );
  return { next, res };
}

describe("cross service authentication", () => {
  it("keeps healthchecks available without a secret", () => {
    expect(request(undefined, undefined, "/api/healthz").next).toHaveBeenCalled();
  });
  it("fails closed if authentication is unconfigured", () => {
    const { next, res } = request(undefined);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
  it.each([undefined, "Bearer wrong", "Bearer secret"])("rejects missing/invalid credentials (%s)", (value) => {
    const { next, res } = request("secret", value);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("accepts the scoped credential used by Next.js", () => {
    const token = createHmac("sha256", "secret").update("megacross:cross-api:v1").digest("hex");
    expect(request("secret", `Bearer ${token}`).next).toHaveBeenCalled();
  });
});
