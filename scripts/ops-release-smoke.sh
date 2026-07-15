#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Emorapy canonical production domains; Vercel project domains remain compatibility aliases.
DEFAULT_MAIN_WEB_URL="https://emorapy.com"
DEFAULT_ADMIN_WEB_URL="https://admin.emorapy.com"

MAIN_WEB_URL="${MAIN_WEB_URL:-${EMORAPY_MAIN_WEB_URL:-$DEFAULT_MAIN_WEB_URL}}"
ADMIN_WEB_URL="${ADMIN_WEB_URL:-${EMORAPY_ADMIN_WEB_URL:-$DEFAULT_ADMIN_WEB_URL}}"
BACKEND_BASE_URL="${BACKEND_BASE_URL:-${EMORAPY_BACKEND_BASE_URL:-}}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-${EMORAPY_FRONTEND_BASE_URL:-${MAIN_WEB_URL}}}"
ADMIN_BASE_URL="${ADMIN_BASE_URL:-${EMORAPY_ADMIN_BASE_URL:-${ADMIN_WEB_URL}}}"
ORIGIN="${ORIGIN:-${EMORAPY_ORIGIN:-${FRONTEND_BASE_URL}}}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-${EMORAPY_ADMIN_ORIGIN:-${ADMIN_BASE_URL}}}"
API_BASE_URL="${API_BASE_URL:-${EMORAPY_API_BASE_URL:-}}"
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
echo "[release-smoke] admin=${ADMIN_BASE_URL}"
echo "[release-smoke] origin=${ORIGIN}"
echo "[release-smoke] admin_origin=${ADMIN_ORIGIN}"
# ADMIN_EMAIL is a secret-derived production identifier; artifacts record presence only.
echo "[release-smoke] admin_email=set"

BACKEND_BASE_URL="$BACKEND_BASE_URL" \
API_BASE_URL="$API_BASE_URL" \
FRONTEND_BASE_URL="$FRONTEND_BASE_URL" \
ADMIN_BASE_URL="$ADMIN_BASE_URL" \
ORIGIN="$ORIGIN" \
ADMIN_ORIGIN="$ADMIN_ORIGIN" \
ADMIN_EMAIL="$ADMIN_EMAIL" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
DATABASE_URL="$DATABASE_URL" \
EMORAPY_RELEASE_GATE=1 \
RUN_AI_LEDGER_RUNTIME_SMOKE=true \
bash "$ROOT/scripts/smoke-production-like.sh"

BACKEND_BASE_URL="$BACKEND_BASE_URL" \
API_BASE_URL="$API_BASE_URL" \
ORIGIN="$ORIGIN" \
DATABASE_URL="$DATABASE_URL" \
EMORAPY_RELEASE_GATE=1 \
CLAIM_SMOKE_DISABLE_CREATED_USER="${CLAIM_SMOKE_DISABLE_CREATED_USER:-true}" \
bash "$ROOT/scripts/smoke-claim-session-production-like.sh"

echo "[release-smoke] post-smoke account hygiene"
npm --prefix backend run ops:smoke-accounts:check

echo "[release-smoke] ok"
