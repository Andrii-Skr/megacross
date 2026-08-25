import { describe, expect, it } from "vitest";
import { z } from "@/lib/zodClient";

describe("client Zod configuration", () => {
  it("disables JIT code generation for strict CSP compatibility", () => {
    expect(z.config().jitless).toBe(true);
  });
});
