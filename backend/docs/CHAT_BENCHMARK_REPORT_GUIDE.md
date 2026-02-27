# Chat Benchmark Report Guide

## 1) Report Files

Primary report:

- `chat-concurrency-gate-report.json`

Child reports:

- `chat-judgment-concurrency-report.json`
- `chat-invite-accept-concurrency-report.json`

## 2) Gate Report Structure

Key fields:

- `gate`: fixed identifier
- `passed`: final gate result
- `generatedAt`: timestamp
- `checks[]`: per-check result
  - `name`: `judgment` or `invite_accept`
  - `exitCode`: script exit code
  - `passed`: merged decision (exit code + report assertion)
  - `reportPath`: child report location

Interpretation:

- `passed=true` means all enabled checks passed.
- any `checks[].passed=false` means release is blocked until resolved.

## 3) Judgment Concurrency Report Interpretation

Critical fields:

- `summary.uniqueCaseIds`
- `summary.uniqueLinkIds`
- `summary.statusCount`
- `summary.codeCount`
- `config` numeric fields (`burstSize`, `statusPollTimes`, `statusPollIntervalMs`, `requestTimeoutMs`)
- `passed`

Pass criteria:

- `uniqueCaseIds.length <= 1`
- `uniqueLinkIds.length <= 1`
- final `passed=true`

Risk signals:

- `uniqueCaseIds.length > 1`: probable duplicate case creation under concurrency
- `uniqueLinkIds.length > 1`: probable duplicate conversion links
- high `5xx` ratio: stability/capacity issue
- config values unexpectedly clamped (check warning logs for invalid/out-of-range env input)

## 4) Invite-Accept Concurrency Report Interpretation

Critical fields:

- `summary.statusCount`
- `summary.codeCount`
- `config.distinctInviteeTokenCount`
- `config.tokenDiversityLimited`
- `config` numeric fields (`burstSize`, `expiresInHours`, `requestTimeoutMs`)
- `final.activeRoleBCount`
- `passed`

Pass criteria:

- exactly one successful accept
- `final.activeRoleBCount === 1`
- `passed=true`

Risk signals:

- more than one success in same burst
- `activeRoleBCount !== 1`
- `tokenDiversityLimited=true` (coverage is limited; result is weaker evidence)
- unexpected 5xx spikes

## 5) Suggested Decision Matrix

- `passed=true` for all reports: allow release progression.
- correctness failure (duplicate case/link or roleB count mismatch): block release.
- only timeout/transient failures: retry once after infra check; still fail then block.

## 6) Required Metadata for Audit

When archiving reports, include:

- commit SHA
- environment name
- API base URL domain
- burst size and timeout config
- run timestamp and operator

## 7) Troubleshooting Quick Commands

From `backend/`:

```bash
npm run bench:chat:judgment-concurrency
npm run bench:chat:invite-accept-concurrency
npm run bench:chat:concurrency-gate
```

If one script fails, run that script independently with `DRY_RUN=true` first to validate env input.
