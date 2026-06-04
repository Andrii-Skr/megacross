#!/usr/bin/env bash
set -euo pipefail

# Simple production deploy/update helper for the monorepo.
# Usage examples:
#   BRANCH=main ./scripts/deploy-prod.sh
#   SEED=1 PRUNE=1 ./scripts/deploy-prod.sh
#   HEALTH_URL=http://127.0.0.1:8080/api/healthz ./scripts/deploy-prod.sh
#   # First-time bootstrap (no .git yet at monorepo root):
#   GIT_URL=git@github.com:org/repo.git BRANCH=main ./scripts/deploy-prod.sh

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$APP_DIR/.." && pwd)}"
LEGACY_CROSS_DIR="${LEGACY_CROSS_DIR:-$REPO_ROOT/cross}"

PROFILE=prod
ROOT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
APP_BRANCH="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
BRANCH="${BRANCH:-${ROOT_BRANCH:-${APP_BRANCH:-main}}}"
REMOTE="${GIT_REMOTE:-origin}"
SEED="${SEED:-0}"
PRUNE="${PRUNE:-0}"
RUN_MIGRATIONS="${MIGRATE:-0}"
CROSS_BRANCH="${CROSS_BRANCH:-}"
CROSS_REMOTE="${CROSS_GIT_REMOTE:-origin}"

# Read APP_PORT from .env (fallback 3000)
APP_PORT_ENV="$(awk -F= '/^APP_PORT[[:space:]]*=/{print $2}' "$APP_DIR/.env" 2>/dev/null | tr -d '"' | tr -d "'" | head -n1 || true)"
APP_PORT="${APP_PORT:-${APP_PORT_ENV:-3000}}"
## Read CROSS_PORT from .env (fallback 3001)
CROSS_PORT_ENV="$(awk -F= '/^CROSS_PORT[[:space:]]*=/{print $2}' "$APP_DIR/.env" 2>/dev/null | tr -d '"' | tr -d "'" | head -n1 || true)"
CROSS_PORT="${CROSS_PORT:-${CROSS_PORT_ENV:-3001}}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}/api/healthz}"
CROSS_HEALTH_URL="${CROSS_HEALTH_URL:-http://127.0.0.1:${CROSS_PORT}/api/healthz}"

echo "📦 Monorepo root: $REPO_ROOT | App dir: $APP_DIR | Branch: $BRANCH | Profile: $PROFILE"

sync_monorepo_root() {
  # Bootstrap repo if the monorepo root is not a Git work tree
  if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if [[ -z "${GIT_URL:-}" ]]; then
      echo "❌ Not a Git repository and GIT_URL is not set."
      echo "   Set GIT_URL=git@github.com:org/repo.git (or HTTPS URL) and re-run."
      exit 1
    fi
    echo "🔧 Bootstrapping monorepo Git root from $GIT_URL (branch: $BRANCH, remote: $REMOTE) ..."
    mkdir -p "$REPO_ROOT"
    git -C "$REPO_ROOT" -c init.defaultBranch="$BRANCH" init
    if git -C "$REPO_ROOT" remote | grep -q "^$REMOTE$"; then
      git -C "$REPO_ROOT" remote set-url "$REMOTE" "$GIT_URL"
    else
      git -C "$REPO_ROOT" remote add "$REMOTE" "$GIT_URL"
    fi
    git -C "$REPO_ROOT" fetch --prune "$REMOTE"
    git -C "$REPO_ROOT" checkout -B "$BRANCH" "$REMOTE/$BRANCH" || {
      git -C "$REPO_ROOT" fetch "$REMOTE" "$BRANCH"
      git -C "$REPO_ROOT" checkout -B "$BRANCH" "$REMOTE/$BRANCH"
    }
  fi

  echo "📥 Syncing monorepo code from Git ($REMOTE/$BRANCH)..."
  git -C "$REPO_ROOT" fetch --all --prune
  git -C "$REPO_ROOT" checkout "$BRANCH"
  git -C "$REPO_ROOT" pull --ff-only "$REMOTE" "$BRANCH"
}

sync_legacy_repos() {
  echo "📦 Root git repo not found. Falling back to legacy multi-repo sync."
  echo "📥 Syncing crossnext repo from Git ($REMOTE/$BRANCH)..."
  git -C "$APP_DIR" fetch --all --prune
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only "$REMOTE" "$BRANCH"

  if [[ ! -d "$LEGACY_CROSS_DIR/.git" ]]; then
    echo "❌ Cross repo not found at: $LEGACY_CROSS_DIR"
    echo "   Set LEGACY_CROSS_DIR explicitly or finish the monorepo git migration."
    exit 1
  fi

  git -C "$LEGACY_CROSS_DIR" fetch --all --prune

  RESOLVED_CROSS_BRANCH="$CROSS_BRANCH"
  if [[ -z "$RESOLVED_CROSS_BRANCH" ]]; then
    if git -C "$LEGACY_CROSS_DIR" show-ref --verify --quiet "refs/remotes/$CROSS_REMOTE/$BRANCH"; then
      RESOLVED_CROSS_BRANCH="$BRANCH"
    elif git -C "$LEGACY_CROSS_DIR" show-ref --verify --quiet "refs/remotes/$CROSS_REMOTE/main"; then
      RESOLVED_CROSS_BRANCH="main"
    elif git -C "$LEGACY_CROSS_DIR" show-ref --verify --quiet "refs/remotes/$CROSS_REMOTE/master"; then
      RESOLVED_CROSS_BRANCH="master"
    else
      RESOLVED_CROSS_BRANCH="$(git -C "$LEGACY_CROSS_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    fi
  fi

  if [[ -z "$RESOLVED_CROSS_BRANCH" || "$RESOLVED_CROSS_BRANCH" == "HEAD" ]]; then
    echo "❌ Unable to resolve cross branch. Set CROSS_BRANCH explicitly."
    exit 1
  fi

  echo "📥 Syncing cross repo ($LEGACY_CROSS_DIR) from Git ($CROSS_REMOTE/$RESOLVED_CROSS_BRANCH)..."
  git -C "$LEGACY_CROSS_DIR" checkout "$RESOLVED_CROSS_BRANCH" || {
    git -C "$LEGACY_CROSS_DIR" fetch "$CROSS_REMOTE" "$RESOLVED_CROSS_BRANCH"
    git -C "$LEGACY_CROSS_DIR" checkout -B "$RESOLVED_CROSS_BRANCH" "$CROSS_REMOTE/$RESOLVED_CROSS_BRANCH"
  }
  git -C "$LEGACY_CROSS_DIR" pull --ff-only "$CROSS_REMOTE" "$RESOLVED_CROSS_BRANCH"
}

if git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  sync_monorepo_root
else
  sync_legacy_repos
fi

echo "🏗️ Building Docker images (profile=$PROFILE)..."
make -C "$APP_DIR" build PROFILE="$PROFILE"

echo "🚀 Starting/Updating services (profile=$PROFILE)..."
make -C "$APP_DIR" up PROFILE="$PROFILE"

echo "⏳ Waiting for Postgres to be healthy..."
make -C "$APP_DIR" pg-wait PROFILE="$PROFILE"

if [[ "$RUN_MIGRATIONS" == "1" || "$RUN_MIGRATIONS" == "true" || "$RUN_MIGRATIONS" == "TRUE" ]]; then
  echo "🧩 Applying migrations (prisma migrate deploy)..."
  make -C "$APP_DIR" migrate PROFILE="$PROFILE"
else
  echo "⏭️  Skipping migrations (MIGRATE=$RUN_MIGRATIONS)"
fi

if [[ "$SEED" == "1" || "$SEED" == "true" || "$SEED" == "TRUE" ]]; then
  echo "🌱 Seeding database..."
  make -C "$APP_DIR" seed PROFILE="$PROFILE" || true
fi

echo "🩺 App health check: $HEALTH_URL"
ATTEMPTS=0
until curl -fsS "$HEALTH_URL" >/dev/null; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [[ $ATTEMPTS -gt 60 ]]; then
    echo "❌ Health check failed after 60s. Recent logs:" >&2
    docker compose -f "$APP_DIR/docker-compose.yml" --profile "$PROFILE" logs --tail 120 app cross db || true
    exit 1
  fi
  sleep 1
done
echo "✅ App health OK"

echo "🩺 Cross health check: $CROSS_HEALTH_URL"
ATTEMPTS=0
until curl -fsS "$CROSS_HEALTH_URL" >/dev/null; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [[ $ATTEMPTS -gt 60 ]]; then
    echo "❌ Cross health check failed after 60s. Recent logs:" >&2
    docker compose -f "$APP_DIR/docker-compose.yml" --profile "$PROFILE" logs --tail 120 cross app db || true
    exit 1
  fi
  sleep 1
done
echo "✅ Cross health OK"

if [[ "$PRUNE" == "1" || "$PRUNE" == "true" || "$PRUNE" == "TRUE" ]]; then
  echo "🧹 Cleaning up unused Docker resources..."
  docker system prune -af --volumes || true
fi

echo "🎉 Deployment complete. App is up on port ${APP_PORT}."
