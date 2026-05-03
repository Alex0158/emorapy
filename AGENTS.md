# CJ Agent Guide

This file is the repo-level operating guide for coding agents. It is not a product spec. Product and engineering truth live under `docs/核心開發文件/`.

## Hard Rules

1. Read `docs/核心開發文件/README.md` before changing product, platform, release, database, or workflow behavior.
2. For environment and release questions, read `docs/核心開發文件/03-管理端與平台治理/04-兩版本運作規範.md` and `docs/核心開發文件/03-管理端與平台治理/05-運維連接與調用Runbook.md`.
3. The project has two official version shapes only:
   - Local development version: localhost apps, no Docker as the application entry.
   - Release version: Vercel web apps + Railway backend + Supabase/Postgres database.
4. CI success means releasable, not released.
5. Vercel success means web released, not backend released.
6. A committed migration file means database change is in code, not that production DB has been migrated.
7. Never use production database credentials for local development unless the user explicitly asks and the command is read-only or the migration plan is confirmed.
8. Do not print secrets. Show hosts, project names, aliases, commit SHAs, and masked values only.

## Fixed Ops Entrypoints

Use these commands before improvising platform calls:

```bash
npm run ops:release:status
npm run ops:db:status
npm run docs:check
```

`ops:release:status` checks git, Vercel version endpoints, optional backend version endpoint, Vercel inspect, and Railway CLI auth/status if available.

`ops:db:status` checks Prisma migration status for the configured database without printing `DATABASE_URL`.

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
5. Use `railway status --json` for the exact active commit, because the backend version endpoint currently does not expose commit SHA.

## Local Development

Local development means:

1. Backend: `cd backend && npm run dev`
2. Main web: `cd frontend && npm run dev`
3. Admin web: `cd frontend-admin && npm run dev`
4. Database: Supabase dev project `Mother Bear Court Dev` (`lbukyqztkkkztfrfltlh`) unless the user explicitly chooses another dev database.
5. Redis is optional for local development; when Redis is not running, keep `REDIS_URL` empty and `ALLOW_SIMPLE_LOCK=true`.

Do not assume local green status means release is current.

## Release Verification

A release is complete only when all relevant checks are true:

1. `HEAD` and `origin/main` are the intended commit.
2. GitHub CI for that commit is successful.
3. Main Vercel production `/version.json` reports that commit.
4. Admin Vercel production `/version.json` reports that commit.
5. Railway backend production deployment status reports that commit as active and successful.
6. Production DB migration state is confirmed if schema changed.
7. Health/ready/smoke checks pass.

If any part is missing, say exactly which part is confirmed and which is not.

## Documentation

Long-lived engineering docs belong in `docs/核心開發文件/`. After changing formal docs, run:

```bash
npm run docs:check
```

Do not create competing active specs outside the core docs tree unless the file is a standard repo control file such as this `AGENTS.md`.
