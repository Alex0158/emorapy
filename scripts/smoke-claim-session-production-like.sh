#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://127.0.0.1:3001}"
API_BASE_URL="${API_BASE_URL:-${BACKEND_BASE_URL}/api/v1}"
ORIGIN="${ORIGIN:-http://127.0.0.1:4173}"
CLAIM_TEST_EMAIL="${CLAIM_TEST_EMAIL:-claim-smoke-$(date +%s)@example.com}"
CLAIM_TEST_PASSWORD="${CLAIM_TEST_PASSWORD:-Password123!}"
CLAIM_TEST_NICKNAME="${CLAIM_TEST_NICKNAME:-Claim Smoke}"
CLAIM_SMOKE_DISABLE_CREATED_USER="${CLAIM_SMOKE_DISABLE_CREATED_USER:-true}"
SMTP_SINK_API_URL="${SMTP_SINK_API_URL:-}"
EMORAPY_RELEASE_GATE="${EMORAPY_RELEASE_GATE:-0}"

HTTP_BODY=""
HTTP_CODE=""
REGISTER_USER_ID=""

log() {
  echo "[claim-smoke] $*"
}

fail() {
  echo "[claim-smoke] FAIL: $*" >&2
  if [ -n "${HTTP_BODY}" ]; then
    HTTP_BODY_INPUT="${HTTP_BODY}" node -e '
const raw = process.env.HTTP_BODY_INPUT || "";
try {
  const payload = JSON.parse(raw);
  const code = payload?.error?.code ?? payload?.code;
  const summary = {};
  if (typeof code === "string" && /^[A-Z0-9_-]{1,80}$/i.test(code)) summary.errorCode = code;
  console.error(`[claim-smoke] Last response summary: ${JSON.stringify(summary)}`);
} catch {
  console.error("[claim-smoke] Last response was non-JSON; body omitted");
}
' >&2
  fi
  exit 1
}

cleanup_claim_user() {
  if [ "${CLAIM_SMOKE_DISABLE_CREATED_USER}" != "true" ] || [ -z "${REGISTER_USER_ID}" ]; then
    return 0
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    if [ ! -f "${BACKEND_DIR}/.env" ]; then
      log "Cleanup skipped: backend/.env not found and DATABASE_URL is not set"
      return 0
    fi

    set -a
    # shellcheck disable=SC1091
    . "${BACKEND_DIR}/.env"
    set +a
  fi

  (
    cd "${BACKEND_DIR}"
    TARGET_USER_ID="${REGISTER_USER_ID}" node <<'NODE'
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const userId = process.env.TARGET_USER_ID;
  if (!userId) return;

  await prisma.user.updateMany({
    where: {
      id: userId,
      email: {
        startsWith: 'claim-smoke-',
      },
    },
    data: {
      is_active: false,
    },
  });
}

main()
  .catch((error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
  ) >/dev/null 2>&1 || true

  log "Cleanup: attempted to disable claim smoke user ${REGISTER_USER_ID}"
}

trap cleanup_claim_user EXIT

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

load_backend_env() {
  if [ -n "${DATABASE_URL:-}" ]; then
    return 0
  fi

  if [ ! -f "${BACKEND_DIR}/.env" ]; then
    fail "backend/.env not found and DATABASE_URL is not set"
  fi

  set -a
  # shellcheck disable=SC1091
  . "${BACKEND_DIR}/.env"
  set +a
}

db_query() {
  local mode="$1"
  local email="$2"

  load_backend_env

  (
    cd "${BACKEND_DIR}"
    QUERY_MODE="${mode}" TARGET_EMAIL="${email}" node <<'NODE'
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const mode = process.env.QUERY_MODE;
  const email = process.env.TARGET_EMAIL;

  if (mode === 'user-id') {
    const row = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email_verified: true },
    });

    if (!row) {
      process.exit(2);
    }

    process.stdout.write(JSON.stringify(row));
    return;
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

main()
  .catch(async (error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
  )
}

read_verification_code_from_sink() {
  local recipient="$1"
  local encoded_recipient
  local message_json=""

  encoded_recipient="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$recipient")"
  for _attempt in {1..30}; do
    message_json="$(curl -fsS --max-time 5 "${SMTP_SINK_API_URL%/}/messages/latest?to=${encoded_recipient}" 2>/dev/null || true)"
    if [ -n "$message_json" ]; then
      MESSAGE_JSON="$message_json" node -e '
const payload = JSON.parse(process.env.MESSAGE_JSON || "{}");
if (typeof payload.verificationCode !== "string" || !/^\d{6}$/.test(payload.verificationCode)) process.exit(2);
process.stdout.write(payload.verificationCode);
' 2>/dev/null && return 0
    fi
    sleep 1
  done
  return 1
}

create_release_registration_proof() {
  if [ "$EMORAPY_RELEASE_GATE" != "1" ]; then
    return 1
  fi
  DATABASE_URL="$DATABASE_URL" \
  EMORAPY_RELEASE_GATE=1 \
  npm --prefix "$BACKEND_DIR" --silent run ops:auth-registration-proof:fixture -- \
    --email="$CLAIM_TEST_EMAIL"
}

db_case_owner() {
  local case_id="$1"

  load_backend_env

  (
    cd "${BACKEND_DIR}"
    TARGET_CASE_ID="${case_id}" node <<'NODE'
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const caseId = process.env.TARGET_CASE_ID;
  const row = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      mode: true,
      plaintiff_id: true,
      session_id: true,
    },
  });

  if (!row) {
    process.exit(2);
  }

  process.stdout.write(JSON.stringify(row));
}

main()
  .catch(async (error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
  )
}

log "Backend base URL: ${BACKEND_BASE_URL}"
log "API base URL: ${API_BASE_URL}"
log "Origin header: ${ORIGIN}"
log "Claim test email: set"

log "1) Create quick session"
request_json "POST" "${API_BASE_URL}/sessions/quick" "{}" -H "Origin: ${ORIGIN}"
expect_status_any "${HTTP_CODE}" "200" "201"
SESSION_ID="$(json_read "${HTTP_BODY}" "data.session_id")"
if [ -z "${SESSION_ID}" ]; then
  fail "Missing data.session_id in quick session response"
fi
log "Quick session created: ${SESSION_ID}"

log "2) Create quick case"
CASE_PAYLOAD='{
  "plaintiff_statement": "I want to confirm that the anonymous quick experience can later be claimed by a registered account through the production-like preflight flow.",
  "defendant_statement": "This counterpart statement is intentionally long enough to pass validation and keep the result page available for the claim-session handoff."
}'
request_json "POST" "${API_BASE_URL}/cases/quick" "${CASE_PAYLOAD}" -H "Origin: ${ORIGIN}" -H "X-Session-Id: ${SESSION_ID}"
expect_status_any "${HTTP_CODE}" "200" "201"
CASE_ID="$(json_read "${HTTP_BODY}" "data.case.id")"
RETURNED_SESSION_ID="$(json_read "${HTTP_BODY}" "data.session_id")"
if [ -z "${CASE_ID}" ] || [ -z "${RETURNED_SESSION_ID}" ]; then
  fail "Missing case id or returned session id in quick case response"
fi
log "Quick case created: ${CASE_ID}"

if [ -n "$SMTP_SINK_API_URL" ]; then
  log "3) Send registration code through the CI SMTP sink"
  SEND_CODE_PAYLOAD="{\"email\":\"${CLAIM_TEST_EMAIL}\",\"type\":\"register\"}"
  request_json "POST" "${API_BASE_URL}/auth/send-verification-code" "${SEND_CODE_PAYLOAD}" -H "Origin: ${ORIGIN}"
  expect_status "200"

  log "4) Verify the delivered registration code"
  VERIFICATION_CODE="$(read_verification_code_from_sink "$CLAIM_TEST_EMAIL")" || fail "Registration code was not delivered to the CI SMTP sink"
  VERIFY_PAYLOAD="{\"email\":\"${CLAIM_TEST_EMAIL}\",\"code\":\"${VERIFICATION_CODE}\",\"type\":\"register\"}"
  request_json "POST" "${API_BASE_URL}/auth/verify-email" "${VERIFY_PAYLOAD}" -H "Origin: ${ORIGIN}"
  expect_status "200"
  REGISTRATION_PROOF="$(json_read "${HTTP_BODY}" "data.registration_proof")"
else
  log "3) Create a release-gated registration proof fixture"
  REGISTRATION_PROOF="$(create_release_registration_proof)" || fail "SMTP_SINK_API_URL or EMORAPY_RELEASE_GATE=1 fixture is required"
fi

if [ -z "$REGISTRATION_PROOF" ]; then
  fail "Missing one-time registration proof"
fi

log "5) Register verified user"
REGISTER_PAYLOAD="{\"email\":\"${CLAIM_TEST_EMAIL}\",\"password\":\"${CLAIM_TEST_PASSWORD}\",\"nickname\":\"${CLAIM_TEST_NICKNAME}\",\"registration_proof\":\"${REGISTRATION_PROOF}\"}"
request_json "POST" "${API_BASE_URL}/auth/register" "${REGISTER_PAYLOAD}" -H "Origin: ${ORIGIN}"
expect_status "201"
REGISTER_TOKEN="$(json_read "${HTTP_BODY}" "data.token")"
REGISTER_USER_ID="$(json_read "${HTTP_BODY}" "data.user.id")"
if [ -z "${REGISTER_TOKEN}" ] || [ -z "${REGISTER_USER_ID}" ]; then
  fail "Missing register token or user id"
fi
log "Registered user id: ${REGISTER_USER_ID}"

log "6) Claim session with register token"
CLAIM_PAYLOAD="{\"session_id\":\"${RETURNED_SESSION_ID}\"}"
request_json "POST" "${API_BASE_URL}/auth/claim-session" "${CLAIM_PAYLOAD}" -H "Origin: ${ORIGIN}" -H "Authorization: Bearer ${REGISTER_TOKEN}"
expect_status "200"
CLAIMED_CASE_ID="$(json_read "${HTTP_BODY}" "data.case_id")"
if [ "${CLAIMED_CASE_ID}" != "${CASE_ID}" ]; then
  fail "Claimed case id ${CLAIMED_CASE_ID} does not match created case id ${CASE_ID}"
fi

log "7) Login with verified user"
LOGIN_PAYLOAD="{\"email\":\"${CLAIM_TEST_EMAIL}\",\"password\":\"${CLAIM_TEST_PASSWORD}\"}"
request_json "POST" "${API_BASE_URL}/auth/login" "${LOGIN_PAYLOAD}" -H "Origin: ${ORIGIN}"
expect_status "200"
LOGIN_TOKEN="$(json_read "${HTTP_BODY}" "data.token")"
if [ -z "${LOGIN_TOKEN}" ]; then
  fail "Missing login token"
fi

log "8) Claim session again with login token (idempotency)"
request_json "POST" "${API_BASE_URL}/auth/claim-session" "${CLAIM_PAYLOAD}" -H "Origin: ${ORIGIN}" -H "Authorization: Bearer ${LOGIN_TOKEN}"
expect_status "200"
CLAIMED_CASE_ID_SECOND="$(json_read "${HTTP_BODY}" "data.case_id")"
if [ "${CLAIMED_CASE_ID_SECOND}" != "${CASE_ID}" ]; then
  fail "Second claim returned unexpected case id ${CLAIMED_CASE_ID_SECOND}"
fi

log "9) Read quick case detail with claimed session continuity"
request_json "GET" "${API_BASE_URL}/cases/${CASE_ID}?session_id=${RETURNED_SESSION_ID}" "" -H "Origin: ${ORIGIN}" -H "Authorization: Bearer ${LOGIN_TOKEN}" -H "X-Session-Id: ${RETURNED_SESSION_ID}"
expect_status "200"

log "10) Verify DB ownership binding"
USER_ROW="$(db_query "user-id" "${CLAIM_TEST_EMAIL}")"
CASE_ROW="$(db_case_owner "${CASE_ID}")"
DB_USER_ID="$(json_read "${USER_ROW}" "id")"
DB_EMAIL_VERIFIED="$(json_read "${USER_ROW}" "email_verified")"
DB_CASE_OWNER_ID="$(json_read "${CASE_ROW}" "plaintiff_id")"
DB_CASE_MODE="$(json_read "${CASE_ROW}" "mode")"
DB_CASE_SESSION_ID="$(json_read "${CASE_ROW}" "session_id")"

if [ "${DB_USER_ID}" != "${REGISTER_USER_ID}" ]; then
  fail "DB user id ${DB_USER_ID} does not match registered user id ${REGISTER_USER_ID}"
fi
if [ "${DB_EMAIL_VERIFIED}" != "true" ]; then
  fail "DB email_verified expected true, got ${DB_EMAIL_VERIFIED}"
fi
if [ "${DB_CASE_OWNER_ID}" != "${REGISTER_USER_ID}" ]; then
  fail "Case plaintiff_id ${DB_CASE_OWNER_ID} does not match registered user id ${REGISTER_USER_ID}"
fi
if [ "${DB_CASE_MODE}" != "quick" ]; then
  fail "Expected case mode quick, got ${DB_CASE_MODE}"
fi
if [ "${DB_CASE_SESSION_ID}" != "${RETURNED_SESSION_ID}" ]; then
  fail "Expected case session_id ${RETURNED_SESSION_ID}, got ${DB_CASE_SESSION_ID}"
fi

log "PASS: claim-session production-like preflight completed"
log "Summary:"
log "  session_id=${RETURNED_SESSION_ID}"
log "  case_id=${CASE_ID}"
log "  user_id=${REGISTER_USER_ID}"
log "  email=set"
