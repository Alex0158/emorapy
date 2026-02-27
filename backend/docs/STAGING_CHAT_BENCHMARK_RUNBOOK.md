# STAGING Chat Benchmark Runbook

## 1) Purpose and Scope

This runbook validates stage-2 chat concurrency behavior before production rollout:

- invite accept concurrency (exactly one successful accept for the same invite code)
- request-judgment concurrency (no duplicated case/link under burst traffic)
- gate aggregation report for CI/manual release checks

This runbook is designed for staging and supports LB/API Gateway multi-instance entry points.

## 2) Preconditions

- Backend service is deployed and reachable.
- Database schema is up-to-date.
- A valid staging auth token set is available.
- Node.js and `npm` are available locally.
- `backend/scripts/.env.benchmark.example` is copied to a local runtime env file.

## 3) Prepare Environment

From `backend/`:

```bash
cp scripts/.env.benchmark.example .env.benchmark.local
```

Update at least:

- `API_BASE_URL` (use staging LB/API Gateway URL)
- `AUTH_TOKEN` or `SESSION_ID`
- `OWNER_AUTH_TOKEN`
- `INVITEE_TOKENS`
- `DRY_RUN` (`true` for parameter validation only, `false` for real traffic)

Numeric env guardrails (script-side clamping):

- `BURST_SIZE`: `2..200`
- `STATUS_POLL_TIMES`: `1..120`
- `STATUS_POLL_INTERVAL_MS`: `200..60000`
- `REQUEST_TIMEOUT_MS`: `1000..120000`
- `EXPIRES_IN_HOURS`: `1..168`

If an invalid numeric value is provided, scripts fall back to defaults and print warning logs.

Invite benchmark quality note:

- provide at least 2 distinct values in `INVITEE_TOKENS`
- if only 1 distinct token is used, report will mark `tokenDiversityLimited=true` (coverage is weaker)

## 4) Dry Run (Required First)

```bash
set -a
source .env.benchmark.local
set +a
npm run bench:chat:concurrency-gate
```

Expected:

- command exits `0`
- gate report exists at `GATE_REPORT_PATH`
- each enabled check has `passed=true` in dry-run mode

## 5) Real Run on Staging

Set `DRY_RUN=false`, then run:

```bash
set -a
source .env.benchmark.local
set +a
npm run bench:chat:concurrency-gate
```

Success criteria:

- gate command exits `0`
- `checks[].passed=true` for all enabled checks
- judgment benchmark has `uniqueCaseIds <= 1` and `uniqueLinkIds <= 1`
- invite benchmark has exactly one success and final `activeRoleBCount=1`

## 6) Multi-Instance Entry Pattern

Use the same `API_BASE_URL` for all checks and point it to:

- a load balancer URL, or
- an API gateway URL fronting multiple backend instances

Do not pin requests to a single pod/instance when validating distributed behavior.

## 7) Failure Triage

If gate fails:

1. inspect `chat-concurrency-gate-report.json`
2. inspect per-check reports:
   - `chat-judgment-concurrency-report.json`
   - `chat-invite-accept-concurrency-report.json`
3. check backend logs for lock contention / conflict / timeout
4. re-run with lower `BURST_SIZE` to separate capacity issues from correctness issues

Common causes:

- invalid tokens or expired session
- staging deployment mismatch across instances
- lock/DB race under very high burst
- network timeout too aggressive (`REQUEST_TIMEOUT_MS`)

## 8) CI Gate Integration (Optional)

Example CI step:

```bash
cd backend
set -a
source .env.benchmark.ci
set +a
npm run bench:chat:concurrency-gate
```

Recommended policy:

- run on release-candidate branch or pre-release pipeline
- fail pipeline when gate exit code is non-zero
- archive gate + per-check JSON reports as build artifacts
- treat warning logs (`⚠️ ... 非法/夾制`) as configuration hygiene issues to be fixed

## 9) Artifacts Checklist

- `chat-concurrency-gate-report.json`
- `chat-judgment-concurrency-report.json`
- `chat-invite-accept-concurrency-report.json`
- command logs (stdout/stderr)

Keep artifacts with build/deploy metadata (commit SHA, environment, timestamp).
