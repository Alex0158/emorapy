#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BACKEND_BASE_URL="${BACKEND_BASE_URL:-}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-}"
ORIGIN="${ORIGIN:-}"
STAGING_ADMIN_EMAIL="${STAGING_ADMIN_EMAIL:-}"
STAGING_ADMIN_PASSWORD="${STAGING_ADMIN_PASSWORD:-}"

fail() {
  echo "[staging-smoke] FAIL: $*" >&2
  exit 1
}

require_non_empty() {
  local key="$1"
  local value="$2"
  if [ -z "${value}" ]; then
    fail "Missing required env: ${key}"
  fi
}

require_non_empty "BACKEND_BASE_URL" "${BACKEND_BASE_URL}"
require_non_empty "FRONTEND_BASE_URL" "${FRONTEND_BASE_URL}"
require_non_empty "STAGING_ADMIN_EMAIL" "${STAGING_ADMIN_EMAIL}"
require_non_empty "STAGING_ADMIN_PASSWORD" "${STAGING_ADMIN_PASSWORD}"

if [ -z "${ORIGIN}" ]; then
  ORIGIN="${FRONTEND_BASE_URL}"
fi

echo "[staging-smoke] backend=${BACKEND_BASE_URL}"
echo "[staging-smoke] frontend=${FRONTEND_BASE_URL}"
echo "[staging-smoke] origin=${ORIGIN}"
echo "[staging-smoke] admin_email=${STAGING_ADMIN_EMAIL}"

BACKEND_BASE_URL="${BACKEND_BASE_URL}" \
API_BASE_URL="${BACKEND_BASE_URL}/api/v1" \
FRONTEND_BASE_URL="${FRONTEND_BASE_URL}" \
ORIGIN="${ORIGIN}" \
ADMIN_EMAIL="${STAGING_ADMIN_EMAIL}" \
ADMIN_PASSWORD="${STAGING_ADMIN_PASSWORD}" \
bash "${ROOT_DIR}/scripts/smoke-production-like.sh"

echo "[staging-smoke] PASS: staging smoke gate completed"
