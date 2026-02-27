# Chat Stage-2 Acceptance Gate

## Scope

This gate confirms stage-2 objectives for:

- conversion snapshot quality and traceability
- context governance and rollback controls
- backend integration coverage
- frontend multi-role e2e matrix
- benchmark readiness and migration rehearsal documentation

## Required Checks

### A) Conversion refinement

- unit tests for `chat.service` pass
- `conversion_snapshot` includes:
  - `layer_usability`
  - `gap_details`
  - `signal_stats`
  - `conversion_version`

### B) Personalization governance

- unit tests for `judgment.service` pass
- governance paths include:
  - feature flag disabled fallback
  - consent-required gating
  - audit payload (when enabled)

### C) Backend integration chain

- integration tests pass:
  - `chat-routes.smoke.test.ts`
  - `chat-invite-judgment-flow.test.ts`

### D) Frontend e2e matrix

- playwright chat suite passes:
  - positive flow
  - 401/403/409/429 failure matrix

### E) Benchmark readiness

- `backend/scripts/.env.benchmark.example` exists
- runbook and report guide exist:
  - `backend/docs/STAGING_CHAT_BENCHMARK_RUNBOOK.md`
  - `backend/docs/CHAT_BENCHMARK_REPORT_GUIDE.md`
- benchmark dry-run gate passes and produces JSON reports

### F) Migration rehearsal artifacts

- rehearsal doc exists:
  - `backend/docs/STAGING_CHAT_MIGRATION_REHEARSAL.md`
- precheck/fix scripts produce report artifacts in staging run

## Suggested Command Set

From repo root:

```bash
cd backend
npx jest tests/unit/services/chat.service.test.ts tests/unit/services/judgment.service.test.ts --runInBand
npx jest tests/unit/scripts/benchmark-chat-concurrency-gate.test.ts --runInBand
npx jest tests/unit/scripts/benchmark-chat-judgment-concurrency.test.ts --runInBand
npx jest tests/unit/scripts/benchmark-chat-invite-accept-concurrency.test.ts --runInBand
npx jest tests/integration/chat-routes.smoke.test.ts tests/integration/chat-invite-judgment-flow.test.ts --runInBand
DRY_RUN=true GATE_RUN_JUDGMENT=true GATE_RUN_INVITE_ACCEPT=true npm run bench:chat:concurrency-gate
# Staging drill (requires DATABASE_URL):
# PRECHECK_REPORT_PATH=./tmp/bench-reports/chat-active-roles-precheck.json npm run precheck:chat:active-roles-uniqueness
# FIX_PLAN_OUTPUT_PATH=./tmp/bench-reports/chat-active-roles-fix-plan.sql FIX_PLAN_REPORT_PATH=./tmp/bench-reports/chat-active-roles-fix-plan.json npm run plan-fix:chat:active-roles-uniqueness
cd ../frontend
npm run test:e2e -- e2e/chat
```

## Final Decision

Release can proceed only when all required checks are green and no unresolved high-severity findings remain.
