import type { RowDataPacket } from "mysql2";
import type { Pool, PoolConnection } from "mysql2/promise";
import { type Pool as PgPool, type PoolClient, types } from "pg";

export interface LegacySyncConfig {
  LEGACY_EXPORT_SCHEMA: string;
  SYNC_BATCH_SIZE: number;
  SYNC_BATCH_SIZE_WORDS?: number;
  SYNC_BATCH_SIZE_OPREDS?: number;
  SYNC_LIMIT_WORDS?: number;
  SYNC_LIMIT_OPREDS?: number;
  SYNC_OPREDS_DROP_FULLTEXT: boolean;
  PG_STATEMENT_TIMEOUT_MS: number;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
}

interface LegacySyncDependencies {
  env: LegacySyncConfig;
  pgPool: Pick<PgPool, "connect">;
  createMySqlPool: () => Promise<Pool>;
  logger?: Pick<Console, "log" | "debug" | "warn">;
}

// GET_LOCK is scoped to the MySQL server, so include the target database in its name.
// The fixed prefix + MD5 fits the 64-character limit on MySQL lock names.
const LOCK_NAME_SQL = "CONCAT('megacross:legacy-sync:', MD5(DATABASE()))";

// Keep DATE columns as calendar dates; pg's default parser creates local-time Date objects.
const exportTypes = {
  getTypeParser: (oid: number) => (oid === types.builtins.DATE ? (value: string) => value : types.getTypeParser(oid)),
};

export function createLegacySync({ env, pgPool, createMySqlPool, logger = console }: LegacySyncDependencies) {
  type WordRow = {
    id: string | number | bigint; // bigint
    word_text: string;
    full_text: string;
    cound: number; // smallint
    lang: string; // char(1)
    file_id: string | number | bigint; // bigint
    user_add: string;
    add_data: string | Date | null; // date
    using: number; // tinyint
    korny: string;
    data_set: string | Date | null; // date
    user_set: string;
    go_flag: number; // tinyint
  };

  type OpredRow = {
    id: string | number | bigint; // bigint
    word_id: string | number | bigint; // bigint
    text_opr: string;
    count_char: number; // int
    end_date: string | Date | null; // date
    lang: string; // char(1)
    tema: string | number; // bigint
    livel: number; // tinyint
    id_file: string | number; // bigint
    use: number; // tinyint
    user_add: string;
    add_data: string | Date | null; // date
    edit_user: string;
    edit_data: string | Date | null; // date
    coment: string;
    set_reg: number; // int
    data_set: string | Date | null; // date
    user_set: string;
    go_flag: number; // tinyint
  };

  const WORD_COLUMNS = [
    "id",
    "word_text",
    "full_text",
    "cound",
    "lang",
    "file_id",
    "user_add",
    "add_data",
    "using",
    "korny",
    "data_set",
    "user_set",
    "go_flag",
  ] as const;

  const OPRED_COLUMNS = [
    "id",
    "word_id",
    "text_opr",
    "count_char",
    "end_date",
    "lang",
    "tema",
    "livel",
    "id_file",
    "use",
    "user_add",
    "add_data",
    "edit_user",
    "edit_data",
    "coment",
    "set_reg",
    "data_set",
    "user_set",
    "go_flag",
  ] as const;

  function logInfo(msg: string) {
    if (env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "info") logger.log(msg);
  }
  function logDebug(msg: string) {
    if (env.LOG_LEVEL === "debug") logger.debug(msg);
  }
  function logWarn(msg: string) {
    if (["debug", "info", "warn"].includes(env.LOG_LEVEL)) logger.warn(msg);
  }
  function toDateOnly(v: string | Date | null | undefined, zeroIfEmpty = false): string {
    if (v == null) return zeroIfEmpty ? "0000-00-00" : "0000-00-00";
    const s = typeof v === "string" ? v : v.toISOString();
    return s.slice(0, 10);
  }

  function normalizeWord(rows: WordRow[]): ReadonlyArray<Record<string, unknown>> {
    return rows.map((r) => ({
      ...r,
      // Coerce DATE columns to 'YYYY-MM-DD' or zero-date
      add_data: toDateOnly(r.add_data, true),
      data_set: toDateOnly(r.data_set, true),
    }));
  }

  function normalizeOpred(rows: OpredRow[]): ReadonlyArray<Record<string, unknown>> {
    return rows.map((r) => ({
      ...r,
      end_date: toDateOnly(r.end_date, true),
      add_data: toDateOnly(r.add_data, true),
      edit_data: toDateOnly(r.edit_data, true),
      data_set: toDateOnly(r.data_set, true),
    }));
  }

  async function ensureBaseTables(conn: PoolConnection) {
    interface TableRow extends RowDataPacket {
      TABLE_NAME: string;
    }
    const [rows] = await conn.query<TableRow[]>(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('word_v','opred_v')",
    );
    const existing = new Set(rows.map((r) => r.TABLE_NAME));
    if (!existing.has("word_v") || !existing.has("opred_v")) {
      throw new Error(
        "В MySQL не найдены базовые таблицы word_v/opred_v. Создайте их заранее (как в легаси) и запустите синк повторно.",
      );
    }
  }

  function buildBulkInsert(
    table: string,
    columns: readonly string[],
    batch: ReadonlyArray<Record<string, unknown>>,
  ): { sql: string; params: unknown[] } {
    const cols = columns.map((c) => `\`${c}\``).join(", ");
    const placeholders = batch.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    const sql = `INSERT INTO \`${table}\` (${cols}) VALUES ${placeholders}`;
    const params: unknown[] = [];
    for (const row of batch) {
      for (const c of columns) params.push((row as Record<string, unknown>)[c]);
    }
    return { sql, params };
  }

  async function loadWordsToTemp(conn: PoolConnection, pg: PoolClient, schema: string, batchSize: number) {
    logInfo("Создание word_v_new...");
    await conn.query("DROP TABLE IF EXISTS `word_v_new`");
    await conn.query("CREATE TABLE `word_v_new` LIKE `word_v`");
    // Speed up bulk load for MyISAM by delaying index rebuild
    await conn.query("ALTER TABLE `word_v_new` DISABLE KEYS");

    const effBatch = env.SYNC_BATCH_SIZE_WORDS ?? batchSize;
    const limitCap = env.SYNC_LIMIT_WORDS ?? Number.POSITIVE_INFINITY;
    let _fetchedTotal = 0;
    let lastId: string | null = null;
    let total = 0;
    for (;;) {
      const where: string = lastId == null ? "" : 'WHERE "id" > $1::bigint';
      const sql = `SELECT ${WORD_COLUMNS.map((c) => `"${c}"`).join(", ")} FROM "${schema}"."word_v" ${where} ORDER BY "id" ASC LIMIT ${effBatch}`;
      const t0 = Date.now();
      const { rows }: { rows: WordRow[] } = await pg.query<WordRow>({
        text: sql,
        values: lastId == null ? [] : [lastId],
        types: exportTypes,
      });
      const dt = Date.now() - t0;
      logDebug(`word_v: получено ${rows.length} строк из PG за ${dt}ms (lastId=${lastId ?? "-"})`);
      if (!rows.length) break;
      const { sql: ins, params } = buildBulkInsert("word_v_new", WORD_COLUMNS, normalizeWord(rows));
      await conn.query(ins, params);
      total += rows.length;
      _fetchedTotal += rows.length;
      lastId = String(rows[rows.length - 1].id);
      if (total >= limitCap) break;
      logDebug(`word_v: вставлено ${rows.length}, всего ${total} (lastId=${lastId})`);
    }
    logInfo(`word_v_new заполнена (${total} строк)`);
    await conn.query("ALTER TABLE `word_v_new` ENABLE KEYS");
  }

  async function loadOpredsToTemp(conn: PoolConnection, pg: PoolClient, schema: string, batchSize: number) {
    logInfo("Создание opred_v_new...");
    await conn.query("DROP TABLE IF EXISTS `opred_v_new`");
    await conn.query("CREATE TABLE `opred_v_new` LIKE `opred_v`");
    if (env.SYNC_OPREDS_DROP_FULLTEXT) {
      try {
        const t0 = Date.now();
        await conn.query(
          "ALTER TABLE `opred_v_new` DROP INDEX `text_opr`, DROP INDEX `user_add`, DROP INDEX `edit_user`",
        );
        logDebug(`opred_v_new: FULLTEXT индексы удалены за ${Date.now() - t0}ms`);
      } catch (e) {
        logWarn("Не удалось удалить FULLTEXT индексы у opred_v_new (продолжаем)");
        logDebug(String(e));
      }
    }
    await conn.query("ALTER TABLE `opred_v_new` DISABLE KEYS");

    const effBatch = env.SYNC_BATCH_SIZE_OPREDS ?? batchSize;
    const limitCap = env.SYNC_LIMIT_OPREDS ?? Number.POSITIVE_INFINITY;
    let lastId: string | null = null;
    let total = 0;
    for (;;) {
      const where: string = lastId == null ? "" : 'WHERE "id" > $1::bigint';
      const sql = `SELECT ${OPRED_COLUMNS.map((c) => `"${c}"`).join(", ")} FROM "${schema}"."opred_v" ${where} ORDER BY "id" ASC LIMIT ${effBatch}`;
      const t0 = Date.now();
      const { rows }: { rows: OpredRow[] } = await pg.query<OpredRow>({
        text: sql,
        values: lastId == null ? [] : [lastId],
        types: exportTypes,
      });
      const dt = Date.now() - t0;
      logDebug(`opred_v: получено ${rows.length} строк из PG за ${dt}ms (lastId=${lastId ?? "-"})`);
      if (!rows.length) break;
      const { sql: ins, params } = buildBulkInsert("opred_v_new", OPRED_COLUMNS, normalizeOpred(rows));
      const tIns0 = Date.now();
      await conn.query(ins, params);
      logDebug(`opred_v: вставка пакета ${rows.length} строк заняла ${Date.now() - tIns0}ms`);
      total += rows.length;
      lastId = String(rows[rows.length - 1].id);
      if (total >= limitCap) break;
      logDebug(`opred_v: вставлено ${rows.length}, всего ${total} (lastId=${lastId})`);
    }
    logInfo(`opred_v_new заполнена (${total} строк)`);
    const tEnable0 = Date.now();
    await conn.query("ALTER TABLE `opred_v_new` ENABLE KEYS");
    logDebug(`opred_v_new: ENABLE KEYS завершён за ${Date.now() - tEnable0}ms`);

    if (env.SYNC_OPREDS_DROP_FULLTEXT) {
      const tFt0 = Date.now();
      await conn.query(
        "ALTER TABLE `opred_v_new` ADD FULLTEXT KEY `text_opr` (`text_opr`), ADD FULLTEXT KEY `user_add` (`user_add`), ADD FULLTEXT KEY `edit_user` (`edit_user`)",
      );
      logDebug(`opred_v_new: FULLTEXT индексы созданы за ${Date.now() - tFt0}ms`);
    }
  }

  async function atomicSwap(conn: PoolConnection) {
    logInfo("Атомарная замена таблиц...");
    // Single RENAME TABLE statement is atomic across multiple renames
    await conn.query(
      "RENAME TABLE `word_v` TO `word_v_old`, `word_v_new` TO `word_v`, `opred_v` TO `opred_v_old`, `opred_v_new` TO `opred_v`",
    );
    // Cleanup old tables
    await conn.query("DROP TABLE IF EXISTS `word_v_old`, `opred_v_old`");
  }

  async function relaxSqlMode(conn: PoolConnection) {
    // Remove NO_ZERO_DATE and NO_ZERO_IN_DATE to allow '0000-00-00' defaults/values found in legacy schema
    // Do not silently change global mode; only session.
    await conn.query("SET SESSION sql_mode = REPLACE(REPLACE(@@sql_mode,'NO_ZERO_DATE',''),'NO_ZERO_IN_DATE','')");
    interface ModeRow extends RowDataPacket {
      mode: string | null;
    }
    const [modes] = await conn.query<ModeRow[]>("SELECT @@session.sql_mode AS mode");
    const mode = Array.isArray(modes) && modes.length ? (modes[0].mode ?? undefined) : undefined;
    logDebug(`SQL_MODE(session): ${mode}`);
  }

  return async function syncOnce(): Promise<void> {
    const pool = await createMySqlPool();
    try {
      const conn = await pool.getConnection();
      let lockHeld = false;
      try {
        const [locks] = await conn.query<(RowDataPacket & { acquired: number | null })[]>(
          `SELECT GET_LOCK(${LOCK_NAME_SQL}, 0) AS acquired`,
        );
        const acquired = locks[0]?.acquired;
        if (acquired === 0) {
          logWarn("Синхронизация уже запущена другим процессом — пропускаю запуск.");
          return;
        }
        if (acquired !== 1) throw new Error("Не удалось получить блокировку legacy-синхронизации");
        lockHeld = true;
        await relaxSqlMode(conn);
        await ensureBaseTables(conn);

        // A dedicated pg client keeps every batch in the same read-only snapshot.
        // Unlike an interactive Prisma transaction, this has no short wall-clock timeout.
        const pg = await pgPool.connect();
        let discardPg = false;
        try {
          await pg.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
          if (env.PG_STATEMENT_TIMEOUT_MS > 0) {
            await pg.query("SELECT set_config('statement_timeout', $1, true)", [`${env.PG_STATEMENT_TIMEOUT_MS}ms`]);
          }
          await loadWordsToTemp(conn, pg, env.LEGACY_EXPORT_SCHEMA, env.SYNC_BATCH_SIZE);
          await loadOpredsToTemp(conn, pg, env.LEGACY_EXPORT_SCHEMA, env.SYNC_BATCH_SIZE);
          await pg.query("COMMIT");
        } catch (error) {
          try {
            await pg.query("ROLLBACK");
          } catch {
            discardPg = true;
          }
          throw error;
        } finally {
          pg.release(discardPg);
        }
        await atomicSwap(conn);
        logInfo("Синхронизация завершена успешно.");
      } finally {
        try {
          if (lockHeld) await conn.query(`SELECT RELEASE_LOCK(${LOCK_NAME_SQL})`);
        } finally {
          // Also release any session lock if acquisition/release failed ambiguously.
          conn.destroy();
        }
      }
    } finally {
      await pool.end();
    }
  };
}
