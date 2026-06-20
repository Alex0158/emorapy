#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEFAULT_MAIN_WEB_URL="https://mother-bear-court.vercel.app"
DEFAULT_ADMIN_WEB_URL="https://frontend-admin-sigma-virid.vercel.app"
EVIDENCE_ROOT="${RELEASE_GATE_EVIDENCE_DIR:-temp/release-gate-evidence}"
RUN_ID="${RELEASE_GATE_EVIDENCE_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
RUN_DIR="${EVIDENCE_ROOT%/}/${RUN_ID}"
LOG_FILE="$RUN_DIR/release-gate.log"
META_FILE="$RUN_DIR/metadata.txt"

mkdir -p "$RUN_DIR"

mask_presence() {
  local value="${1:-}"
  if [ -n "$value" ]; then
    printf 'set'
  else
    printf 'unset'
  fi
}

write_metadata() {
  local phase="$1"
  local exit_code="${2:-}"
  {
    printf 'phase=%s\n' "$phase"
    printf 'run_id=%s\n' "$RUN_ID"
    printf 'started_at_utc=%s\n' "$STARTED_AT"
    printf 'updated_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    if [ -n "$exit_code" ]; then
      printf 'exit_code=%s\n' "$exit_code"
    fi
    printf 'head_sha=%s\n' "$(git rev-parse HEAD)"
    printf 'branch=%s\n' "$(git rev-parse --abbrev-ref HEAD)"
    printf 'main_web_url=%s\n' "${MAIN_WEB_URL:-${EMORAPY_MAIN_WEB_URL:-$DEFAULT_MAIN_WEB_URL}}"
    printf 'admin_web_url=%s\n' "${ADMIN_WEB_URL:-${EMORAPY_ADMIN_WEB_URL:-$DEFAULT_ADMIN_WEB_URL}}"
    printf 'backend_base_url=%s\n' "${BACKEND_BASE_URL:-${EMORAPY_BACKEND_BASE_URL:-unset}}"
    printf 'frontend_base_url=%s\n' "${FRONTEND_BASE_URL:-${EMORAPY_FRONTEND_BASE_URL:-unset}}"
    printf 'admin_base_url=%s\n' "${ADMIN_BASE_URL:-${EMORAPY_ADMIN_BASE_URL:-unset}}"
    printf 'origin=%s\n' "${ORIGIN:-${EMORAPY_ORIGIN:-unset}}"
    printf 'admin_origin=%s\n' "${ADMIN_ORIGIN:-${EMORAPY_ADMIN_ORIGIN:-unset}}"
    printf 'run_mutating_release_smoke=%s\n' "${RUN_MUTATING_RELEASE_SMOKE:-unset}"
    printf 'env_file=%s\n' "${ENV_FILE:-unset}"
    printf 'database_url=%s\n' "$(mask_presence "${DATABASE_URL:-}")"
    printf 'release_smoke_admin_email=%s\n' "$(mask_presence "${RELEASE_SMOKE_ADMIN_EMAIL:-${ADMIN_EMAIL:-}}")"
    printf 'release_smoke_admin_password=%s\n' "$(mask_presence "${RELEASE_SMOKE_ADMIN_PASSWORD:-${ADMIN_PASSWORD:-}}")"
    printf 'log_file=%s\n' "$LOG_FILE"
  } > "$META_FILE"
}

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
write_metadata "started"

echo "[release-gate-evidence] writing evidence to $RUN_DIR"
echo "[release-gate-evidence] metadata: $META_FILE"
echo "[release-gate-evidence] log: $LOG_FILE"

set +e
bash "$ROOT/scripts/ops-release-gate.sh" 2>&1 | tee "$LOG_FILE"
status=${PIPESTATUS[0]}
set -e

write_metadata "finished" "$status"
ln -sfn "$RUN_ID" "${EVIDENCE_ROOT%/}/latest"

if [ "$status" -eq 0 ]; then
  echo "[release-gate-evidence] ok: $RUN_DIR"
else
  echo "[release-gate-evidence] failed with exit code $status: $RUN_DIR" >&2
fi

exit "$status"
