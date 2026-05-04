#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

print_section() {
  printf '\n== %s ==\n' "$1"
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

print_section "Docs Contract"
npm run docs:check

print_section "Backend Build"
npm --prefix backend run build
npm --prefix backend run lint

print_section "Live Release Status"
npm run ops:release:status

print_section "Database Migration State"
npm run ops:db:status

print_section "Smoke Account Hygiene"
npm --prefix backend run ops:smoke-accounts:check

print_section "Product State Audit"
npm --prefix backend run ops:product-state:audit

print_section "Release Gate"
echo "ok"
