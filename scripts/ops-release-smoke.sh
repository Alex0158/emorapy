#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MAIN_WEB_URL="${MAIN_WEB_URL:-https://mother-bear-court.vercel.app}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-${MAIN_WEB_URL}}"
ORIGIN="${ORIGIN:-${FRONTEND_BASE_URL}}"
API_BASE_URL="${API_BASE_URL:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-${RELEASE_SMOKE_ADMIN_EMAIL:-}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${RELEASE_SMOKE_ADMIN_PASSWORD:-}}"
RUN_MUTATING_RELEASE_SMOKE="${RUN_MUTATING_RELEASE_SMOKE:-}"

fail() {
  echo "[release-smoke] FAIL: $*" >&2
  exit 1
}

require_non_empty() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    fail "${name} is required"
  fi
}

if [ "$RUN_MUTATING_RELEASE_SMOKE" != "true" ]; then
  fail "RUN_MUTATING_RELEASE_SMOKE=true is required because release smoke creates production-like test data"
fi

require_non_empty "BACKEND_BASE_URL" "${BACKEND_BASE_URL:-}"
require_non_empty "DATABASE_URL" "${DATABASE_URL:-}"
require_non_empty "ADMIN_EMAIL or RELEASE_SMOKE_ADMIN_EMAIL" "$ADMIN_EMAIL"
require_non_empty "ADMIN_PASSWORD or RELEASE_SMOKE_ADMIN_PASSWORD" "$ADMIN_PASSWORD"

echo "[release-smoke] backend=${BACKEND_BASE_URL}"
echo "[release-smoke] frontend=${FRONTEND_BASE_URL}"
echo "[release-smoke] origin=${ORIGIN}"
echo "[release-smoke] admin_email=${ADMIN_EMAIL}"

BACKEND_BASE_URL="$BACKEND_BASE_URL" \
API_BASE_URL="$API_BASE_URL" \
FRONTEND_BASE_URL="$FRONTEND_BASE_URL" \
ORIGIN="$ORIGIN" \
ADMIN_EMAIL="$ADMIN_EMAIL" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
bash "$ROOT/scripts/smoke-production-like.sh"

BACKEND_BASE_URL="$BACKEND_BASE_URL" \
API_BASE_URL="$API_BASE_URL" \
ORIGIN="$ORIGIN" \
DATABASE_URL="$DATABASE_URL" \
CLAIM_SMOKE_DISABLE_CREATED_USER="${CLAIM_SMOKE_DISABLE_CREATED_USER:-true}" \
bash "$ROOT/scripts/smoke-claim-session-production-like.sh"

echo "[release-smoke] ok"
