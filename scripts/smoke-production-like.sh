#!/usr/bin/env bash

set -euo pipefail

BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://127.0.0.1:3001}"
API_BASE_URL="${API_BASE_URL:-${BACKEND_BASE_URL}/api/v1}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-http://127.0.0.1:4173}"
ADMIN_BASE_URL="${ADMIN_BASE_URL:-${FRONTEND_BASE_URL}}"
# 測試 production-like 後端時，ORIGIN 須為該後端 ALLOWED_ORIGINS 之一，否則 CORS 會 403
ORIGIN="${ORIGIN:-${FRONTEND_BASE_URL}}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-${ADMIN_BASE_URL}}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin-smoke@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-AdminPass1234}"

HTTP_BODY=""
HTTP_CODE=""

log() {
  echo "[smoke] $*"
}

fail() {
  echo "[smoke] FAIL: $*" >&2
  if [ -n "${HTTP_BODY}" ]; then
    echo "[smoke] Last response body: ${HTTP_BODY}" >&2
  fi
  exit 1
}

request_json() {
  local method="$1"
  local url="$2"
  local payload="$3"
  shift 3

  local response=""
  if [ -n "${payload}" ]; then
    response="$(curl -sS --max-time 20 -w '\n%{http_code}' -X "${method}" "${url}" -H "Content-Type: application/json" "$@" -d "${payload}" || true)"
  else
    response="$(curl -sS --max-time 20 -w '\n%{http_code}' -X "${method}" "${url}" "$@" || true)"
  fi

  HTTP_CODE="$(printf '%s' "${response}" | tail -n1)"
  HTTP_BODY="$(printf '%s' "${response}" | sed '$d')"
}

expect_status() {
  local expected="$1"
  if [ "${HTTP_CODE}" != "${expected}" ]; then
    fail "Expected HTTP ${expected}, got ${HTTP_CODE}"
  fi
}

expect_status_any() {
  local actual="${HTTP_CODE}"
  shift
  local expected
  for expected in "$@"; do
    if [ "${actual}" = "${expected}" ]; then
      return 0
    fi
  done
  fail "Expected HTTP in [$*], got ${actual}"
}

json_read() {
  local json_input="$1"
  local path="$2"
  node -e '
const input = process.argv[1];
const path = process.argv[2].split(".");
try {
  let value = JSON.parse(input);
  for (const key of path) {
    if (value == null || !Object.prototype.hasOwnProperty.call(value, key)) {
      process.exit(2);
    }
    value = value[key];
  }
  if (value === undefined || value === null) {
    process.exit(2);
  }
  process.stdout.write(String(value));
} catch {
  process.exit(2);
}
' "${json_input}" "${path}" 2>/dev/null || true
}

log "Backend base URL: ${BACKEND_BASE_URL}"
log "API base URL: ${API_BASE_URL}"
log "Frontend base URL: ${FRONTEND_BASE_URL}"
log "Admin base URL: ${ADMIN_BASE_URL}"
log "Origin header: ${ORIGIN}"
log "Admin origin header: ${ADMIN_ORIGIN}"

log "1) Health checks"
request_json "GET" "${BACKEND_BASE_URL}/health" "" -H "Origin: ${ORIGIN}"
expect_status "200"
request_json "GET" "${BACKEND_BASE_URL}/health/ready" "" -H "Origin: ${ORIGIN}"
expect_status "200"

log "2) Create quick session"
request_json "POST" "${API_BASE_URL}/sessions/quick" "{}" -H "Origin: ${ORIGIN}"
expect_status_any "${HTTP_CODE}" "200" "201"
SESSION_ID="$(json_read "${HTTP_BODY}" "data.session_id")"
if [ -z "${SESSION_ID}" ]; then
  fail "Missing data.session_id in quick session response"
fi
log "Quick session created: ${SESSION_ID}"

log "3) Create quick case"
CASE_PAYLOAD='{
  "plaintiff_statement": "We need a production-like smoke check for quick case creation flow with enough details to pass minimum length validation.",
  "defendant_statement": "This statement is intentionally long enough for validation and ensures the smoke flow can continue to the case detail endpoint."
}'
request_json "POST" "${API_BASE_URL}/cases/quick" "${CASE_PAYLOAD}" -H "Origin: ${ORIGIN}" -H "X-Session-Id: ${SESSION_ID}"
expect_status_any "${HTTP_CODE}" "200" "201"
CASE_ID="$(json_read "${HTTP_BODY}" "data.case.id")"
if [ -z "${CASE_ID}" ]; then
  fail "Missing data.case.id in quick case response"
fi
log "Quick case created: ${CASE_ID}"

log "4) Read quick case detail"
request_json "GET" "${API_BASE_URL}/cases/${CASE_ID}" "" -H "Origin: ${ORIGIN}" -H "X-Session-Id: ${SESSION_ID}"
expect_status "200"

log "5) Check frontend admin login route"
request_json "GET" "${ADMIN_BASE_URL}/admin/login" ""
expect_status "200"

log "6) Admin login API"
ADMIN_LOGIN_PAYLOAD="{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}"
request_json "POST" "${API_BASE_URL}/admin/login" "${ADMIN_LOGIN_PAYLOAD}" -H "Origin: ${ADMIN_ORIGIN}"
expect_status "200"
ADMIN_TOKEN="$(json_read "${HTTP_BODY}" "data.token")"
if [ -z "${ADMIN_TOKEN}" ]; then
  fail "Missing data.token in admin login response"
fi

log "7) Admin me API"
request_json "GET" "${API_BASE_URL}/admin/me" "" -H "Origin: ${ADMIN_ORIGIN}" -H "Authorization: Bearer ${ADMIN_TOKEN}"
expect_status "200"

log "PASS: production-like smoke checks completed"
