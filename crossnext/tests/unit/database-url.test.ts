import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildPostgresUrl } from "@megacross/cross-format/postgres-url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDatabaseUrl } from "@/lib/resolveDatabaseUrl";

afterEach(() => vi.unstubAllEnvs());

describe("PostgreSQL URL encoding", () => {
  it.each([
    "pass#word/part",
    "a@b:c?d%20+e",
    " пробелы та українська ",
    "percent%sign",
  ])("round-trips password %j", (password) => {
    const value = buildPostgresUrl({ user: "user@name", password, host: "db", port: "5432", database: "db/name #1" });
    const parsed = new URL(value);
    expect(decodeURIComponent(parsed.username)).toBe("user@name");
    expect(decodeURIComponent(parsed.password)).toBe(password);
    expect(decodeURIComponent(parsed.pathname.slice(1))).toBe("db/name #1");
    expect(parsed.hostname).toBe("db");
    expect(parsed.search).toBe("?schema=public");
  });

  it("supports IPv6 and a connection without a password", () => {
    const parsed = new URL(buildPostgresUrl({ user: "app", host: "::1", port: 5432, database: "app" }));
    expect(parsed.hostname).toBe("[::1]");
    expect(parsed.password).toBe("");
  });

  it("uses the same encoding for the Prisma environment fallback", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("DATABASE_URL_DEV", undefined);
    vi.stubEnv("POSTGRES_USER", "app");
    vi.stubEnv("POSTGRES_DB", "app");
    vi.stubEnv("POSTGRES_HOST", "db");
    vi.stubEnv("POSTGRES_PASSWORD", "pass#word/part");
    expect(decodeURIComponent(new URL(resolveDatabaseUrl() ?? "").password)).toBe("pass#word/part");
  });

  it("preserves password spaces when reading a secret file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "megacross-password-"));
    try {
      const secret = path.join(root, "password");
      await writeFile(secret, " pass#word/part \n");
      vi.stubEnv("DATABASE_URL", undefined);
      vi.stubEnv("DATABASE_URL_DEV", undefined);
      vi.stubEnv("POSTGRES_USER", "app");
      vi.stubEnv("POSTGRES_DB", "app");
      vi.stubEnv("POSTGRES_PASSWORD", "");
      vi.stubEnv("POSTGRES_PASSWORD_FILE", secret);
      expect(decodeURIComponent(new URL(resolveDatabaseUrl() ?? "").password)).toBe(" pass#word/part ");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(["crossnext", "cross/server"])("encodes the Docker secret in the %s entrypoint", async (project) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "megacross-dsn-"));
    try {
      const password = "pass#word/part@%?";
      const secret = path.join(root, "password");
      await writeFile(secret, `${password}\n`);
      // A harmless readiness probe avoids using any real database in this test.
      await writeFile(path.join(root, "pg_isready"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      const workspace = path.resolve(process.cwd(), "..");
      const output = execFileSync(
        "sh",
        ["entrypoint.sh", process.execPath, "-e", 'process.stdout.write("DSN=" + process.env.DATABASE_URL)'],
        {
          cwd: path.join(workspace, project),
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${root}:${process.env.PATH}`,
            DATABASE_URL: "",
            POSTGRES_USER: "app",
            POSTGRES_DB: "app",
            POSTGRES_HOST: "db",
            POSTGRES_PASSWORD: "",
            POSTGRES_PASSWORD_FILE: secret,
            CROSS_SAMPLES_DIR: path.join(root, "samples"),
            CROSS_OUTPUT_DIR: path.join(root, "out"),
            MIGRATE_ON_START: "0",
            SEED_ON_START: "0",
          },
        },
      );
      const parsed = new URL(output.slice(output.lastIndexOf("DSN=") + 4));
      expect(decodeURIComponent(parsed.password)).toBe(password);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
