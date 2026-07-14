#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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
    HTTP_BODY_INPUT="${HTTP_BODY}" node -e '
const raw = process.env.HTTP_BODY_INPUT || "";
try {
  const payload = JSON.parse(raw);
  const code = payload?.error?.code ?? payload?.code;
  const summary = {};
  if (typeof code === "string" && /^[A-Z0-9_-]{1,80}$/i.test(code)) summary.errorCode = code;
  console.error(`[smoke] Last response summary: ${JSON.stringify(summary)}`);
} catch {
  console.error("[smoke] Last response was non-JSON; body omitted");
}
' >&2
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
    response="$(curl -sS --max-time "${HTTP_MAX_TIME:-20}" -w '\n%{http_code}' -X "${method}" "${url}" -H "Content-Type: application/json" "$@" -d "${payload}" || true)"
  else
    response="$(curl -sS --max-time "${HTTP_MAX_TIME:-20}" -w '\n%{http_code}' -X "${method}" "${url}" "$@" || true)"
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
# Exact case scope prevents false matches; the lookback only absorbs runner/backend/DB clock skew.
LEDGER_SINCE_UTC="$(node -e 'process.stdout.write(new Date(Date.now() - 300000).toISOString())')"
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

if [ "${RUN_AI_LEDGER_RUNTIME_SMOKE:-false}" = "true" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    fail "DATABASE_URL is required when RUN_AI_LEDGER_RUNTIME_SMOKE=true"
  fi

  log "8) Verify live AI request ledger persistence"
  DATABASE_URL="$DATABASE_URL" \
  EMORAPY_RELEASE_GATE="${EMORAPY_RELEASE_GATE:-1}" \
  npm --prefix "$ROOT/backend" run ops:ai-ledger:runtime:check -- \
    --scope-type=case_judgment \
    --scope-id="$CASE_ID" \
    --product-flow=quick_single \
    --request-kind=judgment_draft \
    --since="$LEDGER_SINCE_UTC"

  log "9) Verify Admin costs ledger breakdown"
  HTTP_MAX_TIME=35 request_json "GET" "${API_BASE_URL}/admin/reports/costs" "" \
    -H "Origin: ${ADMIN_ORIGIN}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}"
  expect_status "200"
  COST_REPORT_JSON="$HTTP_BODY" node -e '
const payload = JSON.parse(process.env.COST_REPORT_JSON || "{}");
const data = payload && typeof payload === "object" ? payload.data : null;
const ledger = data?.openai?.ledger;
const reasons = Array.isArray(data?.reasons) ? data.reasons : [];
const quickFlow = Array.isArray(ledger?.productFlows)
  ? ledger.productFlows.find((item) => item?.productFlow === "quick_single")
  : null;
if (ledger?.status !== "ok") {
  console.error(`[smoke] FAIL: Admin costs ledger status=${ledger?.status || "(missing)"}`);
  process.exit(1);
}
if (reasons.some((reason) => String(reason).startsWith("openai ledger:"))) {
  console.error("[smoke] FAIL: Admin costs reports an AI ledger degradation");
  process.exit(1);
}
if (!quickFlow || Number(quickFlow.requestCount24h || 0) < 1) {
  console.error("[smoke] FAIL: Admin costs is missing quick_single ledger activity");
  process.exit(1);
}
console.log("[smoke] Admin costs AI ledger breakdown verified");
'
fi

log "PASS: production-like smoke checks completed"
