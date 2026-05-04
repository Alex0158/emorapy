#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MAIN_WEB_URL="${MAIN_WEB_URL:-https://mother-bear-court.vercel.app}"
ADMIN_WEB_URL="${ADMIN_WEB_URL:-https://frontend-admin-sigma-virid.vercel.app}"

print_section() {
  printf '\n== %s ==\n' "$1"
}

fetch_required_json() {
  local label="$1"
  local url="$2"
  printf '%s: %s\n' "$label" "$url"
  curl -fsS "$url"
  printf '\n'
}

validate_version_endpoint() {
  local label="$1"
  local url="$2"
  local expected_service="$3"
  local expected_sha="$4"
  local json

  printf '%s: %s\n' "$label" "$url"
  json="$(curl -fsS "$url")"
  printf '%s\n' "$json"

  VERSION_JSON="$json" node -e '
const [label, expectedService, expectedSha] = process.argv.slice(1);
const payload = JSON.parse(process.env.VERSION_JSON || "{}");
const data = payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
  ? payload.data
  : payload;
const service = typeof data.service === "string" ? data.service : null;
const version = typeof data.version === "string" ? data.version : null;
const commitSha = typeof data.commitSha === "string"
  ? data.commitSha
  : (typeof data.commitShortSha === "string" ? data.commitShortSha : null);

if (!version) {
  console.error(`[error] ${label} version endpoint did not return a string version`);
  process.exit(1);
}
if (service !== expectedService) {
  console.error(`[error] ${label} service mismatch: expected ${expectedService}, got ${service || "(missing)"}`);
  process.exit(1);
}
if (!commitSha || commitSha === "unknown") {
  console.error(`[error] ${label} version endpoint did not return a concrete commitSha`);
  process.exit(1);
}
if (!(expectedSha.startsWith(commitSha) || commitSha.startsWith(expectedSha))) {
  console.error(`[error] ${label} commit mismatch: expected ${expectedSha}, got ${commitSha}`);
  process.exit(1);
}
console.log(`[ok] ${label} ${version}@${commitSha.slice(0, 7)}`);
' "$label" "$expected_service" "$expected_sha"
}

load_env_file() {
  local file="$1"
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
    line="${line#export }"
    [[ "$line" != *"="* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done < "$file"
}

require_explicit_env() {
  if [ -n "${ENV_FILE:-}" ]; then
    if [ ! -f "$ENV_FILE" ]; then
      echo "[error] ENV_FILE not found: $ENV_FILE" >&2
      exit 1
    fi
    load_env_file "$ENV_FILE"
  fi

  if [ -z "${BACKEND_BASE_URL:-}" ]; then
    echo "[error] BACKEND_BASE_URL is required for release gate backend version/health evidence." >&2
    echo "        Example: BACKEND_BASE_URL=https://<railway-backend-host> npm run ops:release:gate" >&2
    exit 1
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[error] Release gate requires explicit DATABASE_URL=... or ENV_FILE=... ." >&2
    echo "        It intentionally does not infer backend/.env, to avoid checking the dev DB by accident." >&2
    exit 1
  fi
}

require_explicit_env

export CJ_RELEASE_GATE=1
HEAD_SHA="$(git rev-parse HEAD)"

print_section "Docs Contract"
npm run docs:check

print_section "Backend Build"
npm --prefix backend run build
npm --prefix backend run lint

print_section "Live Release Status"
npm run ops:release:status

print_section "Version Gate"
validate_version_endpoint "main web" "${MAIN_WEB_URL%/}/version.json" "frontend" "$HEAD_SHA"
validate_version_endpoint "admin web" "${ADMIN_WEB_URL%/}/version.json" "frontend-admin" "$HEAD_SHA"
validate_version_endpoint "backend" "${BACKEND_BASE_URL%/}/version" "backend" "$HEAD_SHA"

print_section "Backend Health"
fetch_required_json "backend /health/live" "${BACKEND_BASE_URL%/}/health/live"
fetch_required_json "backend /health/ready" "${BACKEND_BASE_URL%/}/health/ready"
fetch_required_json "backend /health" "${BACKEND_BASE_URL%/}/health"

print_section "Database Migration State"
npm run ops:db:status
npm --prefix backend run ops:release-db:check

print_section "AI Pricing Catalog"
npm --prefix backend run ops:ai-pricing:check

print_section "Smoke Account Hygiene"
npm --prefix backend run ops:smoke-accounts:check

print_section "Release Smoke"
npm run ops:release:smoke

print_section "Product State Audit"
npm --prefix backend run ops:product-state:audit

print_section "Release Gate"
echo "ok"
