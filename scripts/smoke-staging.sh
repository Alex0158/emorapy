#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BACKEND_BASE_URL="${BACKEND_BASE_URL:-}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-}"
ORIGIN="${ORIGIN:-}"
STAGING_ADMIN_EMAIL="${STAGING_ADMIN_EMAIL:-}"
STAGING_ADMIN_PASSWORD="${STAGING_ADMIN_PASSWORD:-}"
STAGING_METRICS_TOKEN="${STAGING_METRICS_TOKEN:-}"

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
require_non_empty "STAGING_METRICS_TOKEN" "${STAGING_METRICS_TOKEN}"

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

HTTP_BODY=""
HTTP_CODE=""

request_plain() {
  local url="$1"
  shift

  local response=""
  response="$(curl -sS --max-time 20 -w '\n%{http_code}' "${url}" "$@" || true)"
  HTTP_CODE="$(printf '%s' "${response}" | tail -n1)"
  HTTP_BODY="$(printf '%s' "${response}" | sed '$d')"
}

expect_plain_status() {
  local expected="$1"
  if [ "${HTTP_CODE}" != "${expected}" ]; then
    fail "Expected HTTP ${expected}, got ${HTTP_CODE} for plain request"
  fi
}

expect_body_contains() {
  local needle="$1"
  if ! printf '%s' "${HTTP_BODY}" | grep -Fq "${needle}"; then
    fail "Expected response body to contain: ${needle}"
  fi
}

expect_body_not_contains() {
  local needle="$1"
  if printf '%s' "${HTTP_BODY}" | grep -Fq "${needle}"; then
    fail "Expected response body to not contain: ${needle}"
  fi
}

echo "[staging-smoke] verify /metrics without token is forbidden by metrics guard"
request_plain "${BACKEND_BASE_URL}/metrics"
expect_plain_status "403"
expect_body_contains "# metrics forbidden"
expect_body_not_contains "CORS_ORIGIN_DENIED"

echo "[staging-smoke] verify /metrics ignores hostile Origin and still uses metrics guard"
request_plain "${BACKEND_BASE_URL}/metrics" -H "Origin: https://evil.example.com"
expect_plain_status "403"
expect_body_contains "# metrics forbidden"
expect_body_not_contains "CORS_ORIGIN_DENIED"

echo "[staging-smoke] verify /metrics returns Prometheus text with valid token"
request_plain "${BACKEND_BASE_URL}/metrics" -H "X-Metrics-Token: ${STAGING_METRICS_TOKEN}"
expect_plain_status "200"
expect_body_contains "# HELP"

echo "[staging-smoke] PASS: staging smoke gate completed"
