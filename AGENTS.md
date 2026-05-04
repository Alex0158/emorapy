# CJ Agent Guide

This file is the repo-level operating guide for coding agents. It is not a product spec. Product and engineering truth live under `docs/核心開發文件/`.

## Hard Rules

1. Read `docs/核心開發文件/README.md` before changing product, platform, release, database, or workflow behavior.
2. For environment and release questions, read `docs/核心開發文件/03-管理端與平台治理/04-兩版本運作規範.md` and `docs/核心開發文件/03-管理端與平台治理/05-運維連接與調用Runbook.md`.
3. The project has two official version shapes only:
   - Local development version: localhost apps, Supabase Dev DB, and local Redis; no Docker as the application entry.
   - Release version: Vercel web apps + Railway backend + Supabase/Postgres database.
4. CI success means releasable, not released.
5. Vercel success means web released, not backend released.
6. A committed migration file means database change is in code, not that production DB has been migrated.
7. Any change or discovered drift that must eventually be unified across local/dev and release/prod must be recorded as a pending governance task immediately. This includes database data, schema, migrations, seed data, environment variables, platform config, release wiring, tool auth assumptions, and any other two-side parity requirement. Create or update a Markdown task under `docs/核心開發文件/07-待處理問題與治理/待處理/` with the current state, target release action, verification command, and owner/status notes; do not rely on chat memory.
8. Case access and product-flow classification must not be reimplemented ad hoc from `case.mode`. Backend code must use `backend/src/utils/case-classifier.ts` for session-vs-user access decisions, product-flow labels, judgment/case/reconciliation context eligibility, user-bound case query scopes, stale formal draft cleanup scopes, and case/judgment/execution product-flow reporting filters; docs must record any new flow classification rule before frontend, notification, analytics, scheduled cleanup, context injection, or API behavior is changed.
9. Safety, crisis, repair eligibility, repair journey entry, chat judgment request, partner invite, co-repair, partner notification, and responsibility-ratio visibility decisions must use the shared product-safety policy in `backend/src/utils/product-safety-policy.ts`, the safety-routing service in `backend/src/services/safety-routing.service.ts`, and the shared repair eligibility / repair journey access policy in `backend/src/services/repair-eligibility.service.ts`. Do not hand-code a second high-risk or repair-flow eligibility rule in judgment, reconciliation, chat, notification, execution, or frontend logic.
10. Formal pairing invariants must use the shared normal-pairing rule: one user can have at most one `normal` `pending/active` pairing. Before pairing schema migrations, run `cd backend && npm run precheck:pairing:normal-uniqueness`; do not hand-code a second pairing uniqueness rule.
11. Never use production database credentials for local development unless the user explicitly asks and the command is read-only or the migration plan is confirmed.
12. Do not print secrets. Show hosts, project names, aliases, commit SHAs, and masked values only.

## Fixed Ops Entrypoints

Use these commands before improvising platform calls:

```bash
npm run ops:release:status
npm run ops:release:gate
npm run ops:release:gate:evidence
npm run ops:db:status
cd backend && npm run ops:product-state:audit
cd backend && npm run precheck:pairing:normal-uniqueness
npm run docs:check
```

`ops:release:status` checks git, Vercel version endpoints, optional backend version endpoint, Vercel inspect, and Railway CLI auth/status if available.

`ops:release:gate` is the stricter release closure gate. It requires explicit `BACKEND_BASE_URL` and `DATABASE_URL` or `ENV_FILE`, then verifies docs, backend build/lint, live release status, main/admin/backend version endpoint `service` and `commitSha` alignment with local `HEAD`, backend health/live/ready, DB migration status, smoke account hygiene, and product-state audit. Do not claim a full release is current if this gate cannot run or fails.

`ops:release:gate:evidence` wraps the same release gate and stores a local ignored transcript under `temp/release-gate-evidence/<run-id>/`. Use it for real release closure evidence; it records secret presence only, not secret values.

`ops:db:status` checks Prisma migration status for the configured database without printing `DATABASE_URL`.

`ops:product-state:audit` is a read-only backend consistency audit for stuck case/chat conversion states. Findings include product-flow sample details and recovery proposals, but they are not auto-fixed; record follow-up tasks before changing production data.

`precheck:pairing:normal-uniqueness` is a read-only backend consistency audit for users that appear in more than one `normal` `pending/active` pairing. Run it before pairing-related migrations or production data fixes.

## Platform Map

| Surface | Platform | Repo evidence | Status check |
| --- | --- | --- | --- |
| Main web | Vercel | `.vercel/project.json`, `vercel.json` | `https://mother-bear-court.vercel.app/version.json` |
| Admin web | Vercel | `frontend-admin/.vercel/project.json`, `frontend-admin/vercel.json` | `https://frontend-admin-sigma-virid.vercel.app/version.json` |
| Backend API | Railway | `railway.json`, `backend/railway.toml` | `BACKEND_BASE_URL=<url> npm run ops:release:status` |
| Database | Supabase/Postgres via Prisma | `backend/prisma/schema.prisma`, `backend/prisma/migrations`, `supabase/migrations` | `DATABASE_URL=<url> npm run ops:db:status` |
| CI/source | GitHub/Git | `.github/workflows`, `git` | `gh run view`, `git rev-parse HEAD origin/main` |

## Tool Auth State

Last verified: 2026-05-03.

| Tool | Status | Notes |
| --- | --- | --- |
| Vercel CLI | Authenticated | `vercel whoami` works; production env pull and inspect work. |
| GitHub CLI | Authenticated | `gh auth status` works for `Alex0158`; repo/workflow scopes available. |
| Supabase CLI | Authenticated | `supabase projects list` works; production ref is `pfxrglsjgmpfyiwyxzou`, dev ref is `lbukyqztkkkztfrfltlh`. |
| Railway CLI | Authenticated | `railway whoami`, `railway project list`, and `railway status --json` work. |

Railway browserless login flow, if auth expires:

```bash
railway login --browserless
```

Open `https://railway.com/activate` and enter the displayed code. After completion, verify with:

```bash
railway whoami
railway status --json
```

Do not leave a browserless login process running indefinitely. If activation is not completed, stop it and report that Railway CLI remains unauthenticated.

Current Railway production state, last verified 2026-05-03:

1. Project: `ingenious-commitment`.
2. Production backend domain: `https://mother-bear-court-production.up.railway.app`.
3. Railway CLI can read production deployment state with `railway status --json`.
4. Latest and active production backend deployments were `SUCCESS` after the Railway Docker build fix.
5. Use `npm run ops:release:gate` for full release closure. The backend version endpoint now exposes `commitSha`; if it is missing, `unknown`, or not aligned with local `HEAD`, treat the backend as not fully verified. `railway status --json` remains the source for Railway deployment/log state.

## Frontend Tech Stack (Migration in Progress)

The frontend is actively migrating from Ant Design to shadcn/ui. During the transition period:

| Layer | Legacy (being replaced) | New (target) |
| --- | --- | --- |
| Component library | Ant Design 6 | shadcn/ui + Radix UI |
| Styling | LESS + Tailwind (mixed) | Tailwind CSS 4 only |
| Icons | @ant-design/icons | Lucide React |
| Toast/notifications | antd message | Sonner |
| Forms | Ant Form | Native + react-hook-form + zod |
| Color system | Sage green (#84A59D) | Warm coral (oklch-based, see index.css @theme) |

**Rules during migration:**
1. New pages and migrated pages use shadcn/ui exclusively.
2. Un-migrated pages keep Ant Design until their turn.
3. Do not mix Ant Design and shadcn/ui in the same component.
4. All new UI components go in `src/components/ui/` (shadcn) or `src/components/common/` (branded).
5. Migration progress is tracked in `docs/核心開發文件/07-待處理問題與治理/待處理/UI-UX升級遷移追蹤-2026-05-03.md`.

## Local Development

Local development means:

1. Backend: `cd backend && npm run dev`
2. Main web: `cd frontend && npm run dev`
3. Admin web: `cd frontend-admin && npm run dev`
4. Database: Supabase dev project `Mother Bear Court Dev` (`lbukyqztkkkztfrfltlh`) unless the user explicitly chooses another dev database.
5. Redis is part of the current local development baseline and should run locally, currently `redis://127.0.0.1:6379` in the active local `.env`, with `ALLOW_SIMPLE_LOCK=false`. Do not treat Railway development Redis as required for local development; it is only an optional parity enhancement. If Redis is unavailable and a temporary fallback is needed, record the drift under `docs/核心開發文件/07-待處理問題與治理/待處理/` before using `REDIS_URL=` and `ALLOW_SIMPLE_LOCK=true`.

Do not assume local green status means release is current.

## Release Verification

A release is complete only when all relevant checks are true:

1. `HEAD` and `origin/main` are the intended commit.
2. GitHub CI for that commit is successful.
3. Main Vercel production `/version.json` reports that commit.
4. Admin Vercel production `/version.json` reports that commit.
5. Railway backend production `/version` reports that commit and Railway deployment status is active/successful when CLI evidence is needed.
6. Production DB migration state is confirmed if schema changed.
7. Health/ready/smoke checks pass.

If any part is missing, say exactly which part is confirmed and which is not.

## Documentation

Long-lived engineering docs belong in `docs/核心開發文件/`. After changing formal docs, run:

```bash
npm run docs:check
```

Do not create competing active specs outside the core docs tree unless the file is a standard repo control file such as this `AGENTS.md`.
