import type { Pool, PoolConnection } from "mysql2/promise";
import type { Pool as PgPool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import { createLegacySync, type LegacySyncConfig } from "../../services/legacy-sync/src/sync";

type Row = Record<string, unknown> & { id: string; word_id?: string };
const word = (id: string): Row => ({ id, word_text: `word-${id}` });
const definition = (id: string, wordId: string): Row => ({ id, word_id: wordId, text_opr: `def-${id}` });
const config: LegacySyncConfig = {
  LEGACY_EXPORT_SCHEMA: "legacy_export",
  SYNC_BATCH_SIZE: 1,
  SYNC_OPREDS_DROP_FULLTEXT: false,
  PG_STATEMENT_TIMEOUT_MS: 0,
  LOG_LEVEL: "error",
};
const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function setup(overrides: Partial<LegacySyncConfig> = {}) {
  const tables = new Map<string, Row[]>([
    ["word_v", [word("0")]],
    ["opred_v", [definition("0", "0")]],
  ]);
  const source = { words: [word("1")], definitions: [definition("1", "1")] };
  const calls: { sql: string; params?: unknown[] }[] = [];
  const clients: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> }[] = [];
  const connections: { query: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }[] = [];
  const pools: { getConnection: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }[] = [];
  let lockOwner: object | null = null;
  const hooks = {
    read: async (_sql: string) => {},
    mysql: async (_sql: string) => {},
    pg: async (_sql: string) => {},
    lockResult: undefined as number | null | undefined,
  };
  const pgPool = {
    connect: vi.fn(async () => {
      let snapshot: typeof source | null = null;
      const client = {
        release: vi.fn(),
        query: vi.fn(
          async (
            query:
              | string
              | {
                  text: string;
                  values: unknown[];
                  types: { getTypeParser: (oid: number) => (value: string) => unknown };
                },
            values?: unknown[],
          ) => {
            const sql = typeof query === "string" ? query : query.text;
            const params = typeof query === "string" ? values : query.values;
            calls.push({ sql, params });
            await hooks.pg(sql);
            if (sql.startsWith("BEGIN")) {
              snapshot = structuredClone(source);
              return { rows: [] };
            }
            if (!sql.includes('"legacy_export"')) return { rows: [] };
            if (!snapshot) throw new Error("Read outside transaction");
            const rows = sql.includes('"word_v"') ? snapshot.words : snapshot.definitions;
            const limit = Number(sql.match(/LIMIT (\d+)/)?.[1]);
            const result = rows.filter((row) => !params?.length || BigInt(row.id) > BigInt(String(params[0])));
            await hooks.read(sql);
            return {
              rows: result.slice(0, limit).map((row) => {
                const copy = { ...row };
                if (typeof query !== "string") {
                  for (const key of ["add_data", "data_set", "end_date", "edit_data"]) {
                    if (typeof copy[key] === "string") copy[key] = query.types.getTypeParser(1082)(copy[key]);
                  }
                }
                return copy;
              }),
            };
          },
        ),
      };
      clients.push(client);
      return client as unknown as PoolClient;
    }),
  };
  const createMySqlPool = vi.fn(async () => {
    const conn = {
      destroy: vi.fn(() => {
        if (lockOwner === conn) lockOwner = null;
      }),
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        await hooks.mysql(sql);
        if (sql.includes("GET_LOCK")) {
          const acquired = hooks.lockResult !== undefined ? hooks.lockResult : lockOwner ? 0 : 1;
          if (acquired === 1) lockOwner = conn;
          return [[{ acquired }]];
        }
        if (sql.includes("RELEASE_LOCK")) {
          if (lockOwner === conn) lockOwner = null;
          return [[{ released: 1 }]];
        }
        if (sql.includes("information_schema.TABLES")) return [[{ TABLE_NAME: "word_v" }, { TABLE_NAME: "opred_v" }]];
        if (sql.startsWith("SELECT @@")) return [[{ mode: "" }]];
        if (lockOwner !== conn) throw new Error("Mutation without lock");
        if (sql.startsWith("DROP TABLE")) {
          for (const match of sql.matchAll(/`([^`]+)`/g)) tables.delete(match[1]);
        }
        const create = sql.match(/^CREATE TABLE `([^`]+)`/);
        if (create) tables.set(create[1], []);
        const insert = sql.match(/^INSERT INTO `([^`]+)` \(([^)]+)\)/);
        if (insert) {
          const columns = [...insert[2].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
          const rows = tables.get(insert[1]);
          if (!rows || !params) throw new Error("Missing insert target/params");
          for (let i = 0; i < params.length; i += columns.length) {
            const row = Object.fromEntries(columns.map((key, j) => [key, params[i + j]])) as Row;
            if (rows.some((existing) => existing.id === row.id)) throw new Error("Duplicate ID");
            rows.push(row);
          }
        }
        if (sql.startsWith("RENAME TABLE")) {
          for (const match of sql.matchAll(/`([^`]+)` TO `([^`]+)`/g)) {
            const rows = tables.get(match[1]);
            if (!rows || tables.has(match[2])) throw new Error("Invalid rename");
            tables.set(match[2], rows);
            tables.delete(match[1]);
          }
        }
        return [[]];
      }),
    };
    connections.push(conn);
    const pool = { getConnection: vi.fn(async () => conn as unknown as PoolConnection), end: vi.fn(async () => {}) };
    pools.push(pool);
    return pool as unknown as Pool;
  });
  const dependencies = {
    env: { ...config, ...overrides },
    pgPool: pgPool as unknown as Pick<PgPool, "connect">,
    createMySqlPool,
  };
  return { tables, source, calls, clients, connections, pools, hooks, pgPool, dependencies };
}

describe("legacy sync", () => {
  it("skips an overlapping process before touching staging tables or PostgreSQL", async () => {
    const h = setup();
    const entered = deferred();
    const resume = deferred();
    h.hooks.read = async () => {
      entered.resolve();
      await resume.promise;
    };
    // Separate instances model cron and a manual process sharing the same target DB.
    const first = createLegacySync(h.dependencies)();
    await entered.promise;
    try {
      await createLegacySync(h.dependencies)();
      expect(h.pgPool.connect).toHaveBeenCalledTimes(1);
      expect(h.connections[1].query.mock.calls.map(([sql]) => sql)).toEqual([expect.stringContaining("GET_LOCK")]);
      expect(h.connections[1].destroy).toHaveBeenCalledOnce();
      expect(h.pools[1].end).toHaveBeenCalledOnce();
    } finally {
      resume.resolve();
      await first;
    }
    expect(h.tables.get("word_v")?.map((row) => row.id)).toEqual(["1"]);
    await createLegacySync(h.dependencies)();
    expect(h.pgPool.connect).toHaveBeenCalledTimes(2);
  });

  it("keeps all word batches and definitions in one snapshot despite concurrent edits", async () => {
    const h = setup();
    h.source.words.push(word("2"));
    h.source.definitions.push(definition("2", "2"));
    let changed = false;
    h.hooks.read = async () => {
      if (changed) return;
      changed = true;
      h.source.words = [word("1"), word("3")];
      h.source.definitions = [definition("1", "1"), definition("3", "3")];
    };
    await createLegacySync(h.dependencies)();
    expect(h.tables.get("word_v")?.map((row) => row.id)).toEqual(["1", "2"]);
    expect(h.tables.get("opred_v")?.map((row) => row.word_id)).toEqual(["1", "2"]);
    expect(h.pgPool.connect).toHaveBeenCalledOnce();
    expect(h.calls[0].sql).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(h.calls.at(-1)?.sql).toBe("COMMIT");
    expect(h.clients[0].release).toHaveBeenCalledWith(false);
  });

  it("paginates both tables without rounding bigint IDs", async () => {
    const h = setup();
    const ids = ["9007199254740993", "9007199254740994", "9007199254740995"];
    h.source.words = ids.map(word);
    h.source.definitions = ids.map((id) => definition(id, id));
    await createLegacySync(h.dependencies)();
    expect(h.tables.get("word_v")?.map((row) => row.id)).toEqual(ids);
    expect(h.tables.get("opred_v")?.map((row) => row.id)).toEqual(ids);
    const pagedCalls = h.calls.filter(({ sql }) => sql.includes("WHERE"));
    expect(pagedCalls.map(({ params }) => params)).toEqual([...ids, ...ids].map((id) => [id]));
    expect(pagedCalls.every(({ sql }) => sql.includes('WHERE "id" > $1::bigint'))).toBe(true);
  });

  it("preserves PostgreSQL DATE values without timezone conversion", async () => {
    const h = setup();
    h.source.words[0].add_data = "2026-10-19";
    h.source.definitions[0].end_date = "2027-01-01";
    await createLegacySync(h.dependencies)();
    expect(h.tables.get("word_v")?.[0].add_data).toBe("2026-10-19");
    expect(h.tables.get("opred_v")?.[0].end_date).toBe("2027-01-01");
  });

  it("sets the statement timeout locally without a transaction per batch", async () => {
    const h = setup({ PG_STATEMENT_TIMEOUT_MS: 1234 });
    await createLegacySync(h.dependencies)();
    expect(h.calls[1]).toEqual({ sql: "SELECT set_config('statement_timeout', $1, true)", params: ["1234ms"] });
    expect(h.calls.filter(({ sql }) => sql.startsWith("BEGIN"))).toHaveLength(1);
  });

  it.each([
    "INSERT INTO `word_v_new`",
    "INSERT INTO `opred_v_new`",
  ])("rolls back and preserves published tables when %s fails; retry succeeds", async (failingSql) => {
    const h = setup();
    h.hooks.mysql = async (sql) => {
      if (sql.startsWith(failingSql)) throw new Error("Write failed");
    };
    await expect(createLegacySync(h.dependencies)()).rejects.toThrow("Write failed");
    expect(h.tables.get("word_v")?.map((row) => row.id)).toEqual(["0"]);
    expect(h.tables.get("opred_v")?.map((row) => row.id)).toEqual(["0"]);
    expect(h.calls.at(-1)?.sql).toBe("ROLLBACK");
    expect(h.clients[0].release).toHaveBeenCalledWith(false);
    expect(h.connections[0].query).toHaveBeenCalledWith(expect.stringContaining("RELEASE_LOCK"));
    expect(h.connections[0].destroy).toHaveBeenCalledOnce();
    expect(h.pools[0].end).toHaveBeenCalledOnce();
    h.hooks.mysql = async () => {};
    await createLegacySync(h.dependencies)();
    expect(h.tables.get("word_v")?.map((row) => row.id)).toEqual(["1"]);
  });

  it("does not publish if the snapshot transaction cannot commit", async () => {
    const h = setup();
    h.hooks.pg = async (sql) => {
      if (sql === "COMMIT" || sql === "ROLLBACK") throw new Error("Connection lost");
    };
    await expect(createLegacySync(h.dependencies)()).rejects.toThrow("Connection lost");
    expect(h.tables.get("word_v")?.map((row) => row.id)).toEqual(["0"]);
    expect(h.clients[0].release).toHaveBeenCalledWith(true);
    expect(h.connections[0].destroy).toHaveBeenCalledOnce();
  });

  it("fails closed when MySQL cannot acquire the lock", async () => {
    const h = setup();
    h.hooks.lockResult = null;
    await expect(createLegacySync(h.dependencies)()).rejects.toThrow("блокировку");
    expect(h.pgPool.connect).not.toHaveBeenCalled();
    expect(h.connections[0].query).toHaveBeenCalledOnce();
    expect(h.connections[0].destroy).toHaveBeenCalledOnce();
  });

  it("closes the MySQL session even when explicit unlock fails", async () => {
    const h = setup();
    h.hooks.mysql = async (sql) => {
      if (sql.includes("RELEASE_LOCK")) throw new Error("Unlock failed");
    };
    await expect(createLegacySync(h.dependencies)()).rejects.toThrow("Unlock failed");
    expect(h.connections[0].destroy).toHaveBeenCalledOnce();
    h.hooks.mysql = async () => {};
    await createLegacySync(h.dependencies)();
    expect(h.pgPool.connect).toHaveBeenCalledTimes(2);
  });

  it("releases the MySQL lock if acquiring the PostgreSQL connection fails", async () => {
    const h = setup();
    h.pgPool.connect.mockRejectedValueOnce(new Error("Postgres unavailable"));
    await expect(createLegacySync(h.dependencies)()).rejects.toThrow("Postgres unavailable");
    expect(h.connections[0].query).toHaveBeenCalledWith(expect.stringContaining("RELEASE_LOCK"));
    expect(h.connections[0].destroy).toHaveBeenCalledOnce();
    expect(h.tables.has("word_v_new")).toBe(false);
  });
});
