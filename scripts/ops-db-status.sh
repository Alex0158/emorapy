#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"

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

ENV_FILE="${ENV_FILE:-}"
if [ -n "$ENV_FILE" ]; then
  if [ ! -f "$ENV_FILE" ]; then
    echo "[error] ENV_FILE not found: $ENV_FILE" >&2
    exit 1
  fi
  load_env_file "$ENV_FILE"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "$BACKEND_DIR/.env" ]; then
    load_env_file "$BACKEND_DIR/.env"
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[error] DATABASE_URL is not set. Provide DATABASE_URL=... or ENV_FILE=..." >&2
  exit 1
fi

node - <<'NODE'
const url = process.env.DATABASE_URL || '';
try {
  const parsed = new URL(url);
  console.log('database host:', parsed.hostname);
  console.log('database name:', parsed.pathname.replace(/^\//, '') || '(none)');
  console.log('database user:', parsed.username || '(none)');
  console.log('database sslmode:', parsed.searchParams.get('sslmode') || '(not set)');
} catch (error) {
  console.log('database host: unable to parse DATABASE_URL');
}
NODE

cd "$BACKEND_DIR"
npx prisma migrate status --schema prisma/schema.prisma
