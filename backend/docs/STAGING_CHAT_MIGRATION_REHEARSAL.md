# Staging Chat Migration Rehearsal

## Goal

Produce a repeatable and auditable rehearsal record for chat active-role uniqueness migration safety checks.

## Scripts Used

- `npm run precheck:chat:active-roles-uniqueness`
- `npm run plan-fix:chat:active-roles-uniqueness`

## Preconditions

- staging `DATABASE_URL` is available
- scripts run from `backend/`
- output folder exists or can be created (`./tmp/bench-reports`)

## Execution Steps

### 1) Precheck

```bash
PRECHECK_REPORT_PATH=./tmp/bench-reports/chat-active-roles-precheck.json \
npm run precheck:chat:active-roles-uniqueness
```

Expected:

- exit `0` when no violations
- exit `2` when duplicates are found (this is not script failure; it is a data finding)

### 2) Fix Plan Generation

```bash
FIX_PLAN_OUTPUT_PATH=./tmp/bench-reports/chat-active-roles-fix-plan.sql \
FIX_PLAN_REPORT_PATH=./tmp/bench-reports/chat-active-roles-fix-plan.json \
npm run plan-fix:chat:active-roles-uniqueness
```

Expected:

- SQL fix plan generated for manual review
- JSON report generated with keep/deactivate candidate ids

## Rehearsal Record Template

Fill the following section after each staging run:

- Rehearsal Date:
- Operator:
- Environment:
- Commit SHA:
- Precheck Exit Code:
- Precheck Total Violations:
- Fix Plan Generated: yes/no
- SQL Path:
- JSON Report Path:
- Manual Review Result:
- Next Action:

## Acceptance Criteria

- Precheck has report artifact.
- If violations exist, fix-plan SQL + JSON artifacts are generated.
- Review outcome is documented before migration execution.

## Notes

- The fix-plan script does not modify DB data.
- Apply SQL only after manual review and change approval.
