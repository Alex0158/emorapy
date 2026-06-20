#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Legacy production default until Emorapy domain migration; prefer EMORAPY_* overrides when configured.
DEFAULT_MAIN_WEB_URL="https://mother-bear-court.vercel.app"
DEFAULT_ADMIN_WEB_URL="https://frontend-admin-sigma-virid.vercel.app"

MAIN_WEB_URL="${MAIN_WEB_URL:-${EMORAPY_MAIN_WEB_URL:-$DEFAULT_MAIN_WEB_URL}}"
ADMIN_WEB_URL="${ADMIN_WEB_URL:-${EMORAPY_ADMIN_WEB_URL:-$DEFAULT_ADMIN_WEB_URL}}"
BACKEND_BASE_URL="${BACKEND_BASE_URL:-${EMORAPY_BACKEND_BASE_URL:-}}"

print_section() {
  printf '\n== %s ==\n' "$1"
}

fetch_json() {
  local label="$1"
  local url="$2"
  printf '%s: %s\n' "$label" "$url"
  if ! curl -fsS "$url"; then
    printf '\n[warn] failed to fetch %s\n' "$url" >&2
    return 1
  fi
  printf '\n'
}

print_section "Git"
HEAD_SHA="$(git rev-parse HEAD)"
ORIGIN_SHA="$(git rev-parse origin/main 2>/dev/null || true)"
printf 'HEAD:        %s\n' "$HEAD_SHA"
printf 'origin/main: %s\n' "${ORIGIN_SHA:-unavailable}"
git status -sb

print_section "Version Endpoints"
fetch_json "main web" "${MAIN_WEB_URL%/}/version.json" || true
fetch_json "admin web" "${ADMIN_WEB_URL%/}/version.json" || true
if [ -n "$BACKEND_BASE_URL" ]; then
  fetch_json "backend /version" "${BACKEND_BASE_URL%/}/version" || \
    fetch_json "backend /api/v1/version" "${BACKEND_BASE_URL%/}/api/v1/version" || true
else
  echo "[info] BACKEND_BASE_URL not set; skipping backend live version check."
fi

print_section "Vercel"
if command -v vercel >/dev/null 2>&1; then
  vercel inspect "$MAIN_WEB_URL" || true
  vercel inspect "$ADMIN_WEB_URL" || true
else
  echo "[warn] vercel CLI not found."
fi

print_section "Railway"
if command -v railway >/dev/null 2>&1; then
  if railway whoami >/dev/null 2>&1; then
    railway status --json || true
  else
    echo "[warn] railway CLI is installed but not authenticated."
  fi
else
  echo "[warn] railway CLI not found."
fi

print_section "Database"
echo "Run DATABASE_URL=<dev-or-prod-url> npm run ops:db:status to verify Prisma migration state."
echo "Run DATABASE_URL=<dev-or-prod-url> npm --prefix backend run ops:smoke-accounts:check to verify active smoke/dev account hygiene."
