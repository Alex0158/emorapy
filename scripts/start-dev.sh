#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/logs"
REDIS_DIR="${EMORAPY_DEV_REDIS_DIR:-/tmp/emorapy-redis-dev}"
HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || printf unknown)"
PIDS=()
OWNED_REDIS_PID=""

mkdir -p "$LOG_DIR" "$REDIS_DIR"

cleanup() {
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  wait "${PIDS[@]}" >/dev/null 2>&1 || true
}

fail() {
  printf '[start-dev] FAIL: %s\n' "$*" >&2
  cleanup
  exit 1
}

port_is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

require_free_port() {
  local port="$1"
  local label="$2"
  if port_is_listening "$port"; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2 || true
    fail "${label} port ${port} is already in use"
  fi
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local i
  for i in {1..40}; do
    if port_is_listening "$port"; then
      printf '[start-dev] %s ready on port %s\n' "$label" "$port"
      return 0
    fi
    sleep 0.5
  done
  fail "${label} did not listen on port ${port}"
}

ensure_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "${command_name} is required"
}

ensure_redis() {
  if command -v redis-cli >/dev/null 2>&1 && redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
    printf '[start-dev] Redis already available at 127.0.0.1:6379\n'
    return 0
  fi

  require_free_port 6379 "Redis"
  ensure_command redis-server

  printf '[start-dev] starting local Redis at 127.0.0.1:6379\n'
  redis-server --port 6379 --dir "$REDIS_DIR" --appendonly yes > "$LOG_DIR/redis.log" 2>&1 &
  OWNED_REDIS_PID="$!"
  PIDS+=("$OWNED_REDIS_PID")

  local i
  for i in {1..40}; do
    if command -v redis-cli >/dev/null 2>&1 && redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
      printf '[start-dev] Redis ready on port 6379\n'
      return 0
    fi
    sleep 0.5
  done

  fail "Redis did not become ready on port 6379"
}

start_service() {
  local label="$1"
  local port="$2"
  local log_file="$3"
  shift 3

  require_free_port "$port" "$label"
  printf '[start-dev] starting %s\n' "$label"
  "$@" > "$LOG_DIR/$log_file" 2>&1 &
  PIDS+=("$!")
  wait_for_port "$port" "$label"
}

trap cleanup INT TERM EXIT

ensure_command node
ensure_command npm

printf '[start-dev] starting local development stack at %s\n' "$HEAD_SHA"
ensure_redis
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export ALLOW_SIMPLE_LOCK="${ALLOW_SIMPLE_LOCK:-false}"

start_service "backend" 3001 "backend.log" \
  bash -lc "cd '$ROOT/backend' && EMORAPY_COMMIT_SHA='$HEAD_SHA' npm run dev"

start_service "main frontend" 5173 "frontend.log" \
  bash -lc "cd '$ROOT/frontend' && npm run dev -- --host 127.0.0.1"

start_service "admin frontend" 5175 "frontend-admin.log" \
  bash -lc "cd '$ROOT/frontend-admin' && npm run dev -- --host 127.0.0.1"

cat <<EOF

[start-dev] local development stack is running
[start-dev] backend:        http://127.0.0.1:3001
[start-dev] main frontend:  http://127.0.0.1:5173
[start-dev] admin frontend: http://127.0.0.1:5175
[start-dev] redis:          redis://127.0.0.1:6379
[start-dev] logs:
  - logs/backend.log
  - logs/frontend.log
  - logs/frontend-admin.log
  - logs/redis.log (only when this script started Redis)

Press Ctrl+C to stop services started by this script.
EOF

wait
