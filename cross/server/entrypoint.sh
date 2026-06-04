#!/usr/bin/env sh
set -eu

log() { echo "[cross-entrypoint] $*"; }

# Compose DATABASE_URL from POSTGRES_* + secret when explicit DATABASE_URL is absent.
if [ -z "${DATABASE_URL:-}" ]; then
  PW="${POSTGRES_PASSWORD:-}"
  if [ -z "$PW" ] && [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "$POSTGRES_PASSWORD_FILE" ]; then
    PW="$(cat "$POSTGRES_PASSWORD_FILE")"
  elif [ -z "$PW" ] && [ -f "/run/secrets/postgres_password" ]; then
    PW="$(cat /run/secrets/postgres_password)"
  fi

  DB_HOST="${POSTGRES_HOST:-db}"
  DB_PORT="${POSTGRES_PORT:-5432}"
  DB_USER="${POSTGRES_USER:-app}"
  DB_NAME="${POSTGRES_DB:-app}"

  if [ -n "$PW" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${PW}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
  else
    export DATABASE_URL="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
  fi
  log "DATABASE_URL constructed for ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
else
  log "DATABASE_URL provided"
fi

SAMPLES_DIR="${CROSS_SAMPLES_DIR:-/app/var/crosswords/sample}"
OUTPUT_DIR="${CROSS_OUTPUT_DIR:-/app/var/crosswords/out}"
mkdir -p "$SAMPLES_DIR" "$OUTPUT_DIR"

if [ "${MIGRATE_ON_START:-}" = "1" ] || [ "${MIGRATE_ON_START:-}" = "true" ] || [ "${MIGRATE_ON_START:-}" = "TRUE" ]; then
  log "Running prisma migrate deploy"
  pnpm prisma migrate deploy
fi

log "Starting cross service: $*"
exec "$@"
