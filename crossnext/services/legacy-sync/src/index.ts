import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import type { Pool, PoolOptions } from "mysql2/promise";
import mysql from "mysql2/promise";
import { Pool as PgPool } from "pg";
import { z } from "zod";
import { createLegacySync } from "./sync";

// Optional dependency: node-cron. Loaded lazily to avoid runtime dep when SYNC_CRON not set.
type CronModule = typeof import("node-cron");

const toBool = (v?: string) => typeof v === "string" && /^(1|true|yes|y|on)$/i.test(v.trim());

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  LEGACY_MYSQL_URL: z.string().url(),
  LEGACY_EXPORT_SCHEMA: z
    .string()
    .default("legacy_export")
    .transform((v) => v.trim())
    .refine((v) => /^[A-Za-z0-9_]+$/.test(v), {
      message: "LEGACY_EXPORT_SCHEMA must contain only letters, digits or underscore",
    }),
  SYNC_BATCH_SIZE: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10000))
    .pipe(z.number().int().positive()),
  SYNC_BATCH_SIZE_WORDS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  SYNC_BATCH_SIZE_OPREDS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  SYNC_LIMIT_WORDS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  SYNC_LIMIT_OPREDS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  SYNC_MODE: z.enum(["full"]).default("full"),
  SYNC_CRON: z.string().optional(), // if absent -> run once and exit
  SYNK_TEST: z
    .string()
    .optional()
    .transform((v) => (v ? toBool(v) : false))
    .pipe(z.boolean()),
  RUN_ONCE: z
    .string()
    .optional()
    .transform((v) => (v ? toBool(v) : false))
    .pipe(z.boolean()),
  PG_STATEMENT_TIMEOUT_MS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0))
    .pipe(z.number().int().min(0)),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Управление ускорением загрузки opred_v (MyISAM):
  // при true удаляем FULLTEXT индексы на время bulk-вставки и создаём их после
  SYNC_OPREDS_DROP_FULLTEXT: z
    .string()
    .optional()
    .transform((v) => (v ? toBool(v) : true))
    .pipe(z.boolean()),
});

// Load env with different precedence for local vs container runs
const shellSnapshot = { ...process.env } as Record<string, string | undefined>;
const cwd = process.cwd();
const envPath = path.join(cwd, ".env");
const envLocalPath = path.join(cwd, ".env.local");
const isInContainer = fs.existsSync("/.dockerenv");
// Always load .env if present
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
// Only load .env.local for local runs (not inside container)
if (!isInContainer && fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });
// For local runs, give .env.local precedence for selected keys, even if shell had them set.
const localPriorityKeys = new Set([
  "SYNK_TEST",
  "SYNC_BATCH_SIZE",
  "SYNC_BATCH_SIZE_WORDS",
  "SYNC_BATCH_SIZE_OPREDS",
  "LOG_LEVEL",
]);
for (const [k, v] of Object.entries(shellSnapshot)) {
  if (typeof v === "undefined") continue;
  if (!isInContainer && localPriorityKeys.has(k)) continue; // respect .env.local for these keys locally
  process.env[k] = v;
}

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (e) {
    logError(
      "Отсутствуют обязательные переменные окружения. Укажите DATABASE_URL (Postgres) и LEGACY_MYSQL_URL (MySQL).\n" +
        "Добавьте их в .env.local или передайте в окружении. Примеры см. в .env.example или docs/legacy-sync.md",
      e,
    );
    process.exit(1);
  }
};

const env = parseEnv();

const pgPool = new PgPool({ connectionString: env.DATABASE_URL });
const syncOnce = createLegacySync({ env, pgPool, createMySqlPool });

// Print effective config at info level to aid troubleshooting
const envSource = isInContainer ? "container:.env" : "local:.env.local>.env";
logInfo(
  `sync-config: source=${envSource}, LOG_LEVEL=${env.LOG_LEVEL}, SYNC_BATCH_SIZE=${env.SYNC_BATCH_SIZE}, ` +
    `SYNC_BATCH_SIZE_WORDS=${env.SYNC_BATCH_SIZE_WORDS ?? "-"}, SYNC_BATCH_SIZE_OPREDS=${
      env.SYNC_BATCH_SIZE_OPREDS ?? "-"
    }, ` +
    `SYNC_OPREDS_DROP_FULLTEXT=${env.SYNC_OPREDS_DROP_FULLTEXT}`,
);

async function createMySqlPool(): Promise<Pool> {
  const config: PoolOptions = {
    uri: env.LEGACY_MYSQL_URL,
    // Enable multi statements for setup/cleanup convenience
    multipleStatements: true,
    // Ensure text encoding for cp1251 tables is handled by the driver
    charset: "cp1251_general_ci",
    connectionLimit: 2,
    // Avoid timezone surprises; pass dates as JS Date objects or ISO strings
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
  return mysql.createPool(config);
}

function logInfo(msg: string) {
  if (env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "info") console.log(msg);
}
function logWarn(msg: string) {
  if (["debug", "info", "warn"].includes(env.LOG_LEVEL)) console.warn(msg);
}
function logError(msg: string, err?: unknown) {
  console.error(msg);
  if (err) console.error(err);
}

async function main() {
  if (env.RUN_ONCE) {
    await syncOnce();
    await pgPool.end();
    return;
  }

  // Default schedule: test mode => every 5 minutes; else daily at 03:00
  const derivedCron = env.SYNC_CRON ?? (env.SYNK_TEST ? "*/5 * * * *" : "0 3 * * *");
  if (derivedCron) {
    let cron: CronModule | null = null;
    try {
      cron = await import("node-cron");
    } catch (e) {
      logError(
        "Установите зависимость 'node-cron' или уберите SYNC_CRON, чтобы запускать синхронизацию один раз и выйти.",
        e,
      );
      process.exit(1);
    }
    logInfo(`Расписание включено: ${derivedCron}${env.SYNK_TEST ? " (test mode)" : ""}`);
    let running = false;
    const task = cron.schedule(derivedCron, async () => {
      if (running) {
        logWarn("Предыдущий запуск ещё идёт — пропускаю текущий тик.");
        return;
      }
      running = true;
      try {
        await syncOnce();
      } catch (e) {
        logError("Ошибка синхронизации", e);
      } finally {
        running = false;
      }
    });
    // Graceful shutdown
    const stop = async () => {
      logWarn("Остановка по сигналу...");
      task.stop();
      await pgPool.end();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } else {
    await syncOnce();
    await pgPool.end();
    // Exit after single run
  }
}

main().catch(async (e) => {
  logError("Критическая ошибка", e);
  await pgPool.end();
  process.exit(1);
});
