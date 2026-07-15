# 運維連接與調用Runbook

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：Vercel、Railway、Supabase/Postgres、Git/GitHub 與本機 `.env` 的固定連接、查詢與發布操作口徑
**取證代碼入口**：`package.json`、`.github/workflows/production-deploy-and-verify.yml`、`scripts/rollback-production-release.mjs`、`scripts/lib/production-release-state.mjs`、`scripts/lib/production-release-state.test.mjs`、`scripts/ops-release-status.sh`、`scripts/ops-release-gate.sh`、`scripts/ops-release-gate-evidence.sh`、`scripts/ops-release-smoke.sh`、`scripts/smoke-production-like.sh`、`scripts/smoke-claim-session-production-like.sh`、`scripts/ops-db-status.sh`、`backend/package.json`、`backend/scripts/check-release-db-parity.ts`、`backend/scripts/check-ai-pricing-catalog.ts`、`backend/scripts/verify-ai-request-ledger-runtime.ts`、`backend/scripts/audit-product-state-consistency.ts`、`backend/scripts/check-smoke-account-hygiene.ts`、`backend/scripts/precheck-pairing-normal-uniqueness.ts`、`backend/.env.example`、`frontend/.env.example`、`frontend-admin/.env.example`、`backend/railway.toml`、`backend/prisma/schema.prisma`、`backend/prisma/migrations`、`backend/src/config/database.ts`、`backend/src/config/env.ts`、`backend/src/routes/health.routes.ts`、`backend/src/routes/admin.routes.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/services/ai-cost-pricing.service.ts`、`backend/src/services/ai-request-ledger.service.ts`、`backend/src/services/cost-monitoring.service.ts`、`backend/src/services/notification.service.ts`、`backend/src/services/product-state-recovery-task.service.ts`、`backend/src/utils/case-classifier.ts`、`backend/src/utils/pairing-invariant.ts`、`backend/src/utils/validation.ts`
**最後核驗 Commit**：`b3f3716`
**最後核驗日期**：`2026-07-14`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文件固定 agent 與開發者連接平台、查版本、查資料庫、部署 production 與判定發布狀態的方法。目標是讓日常運維不依賴臨場記憶，也不靠重複試錯。

## 1. 固定入口

優先使用 repo 內命令：

```bash
npm run ops:release:status
npm run ops:release:gate
npm run ops:release:gate:evidence
npm run ops:release:smoke
npm run ops:db:status
cd backend && npm run ops:product-state:audit
cd backend && npm run ops:product-state:audit:persist
cd backend && npm run ops:release-db:check
cd backend && npm run ops:ai-pricing:check
cd backend && npm run ops:smoke-accounts:check
cd backend && npm run precheck:pairing:normal-uniqueness
npm run docs:check
```

`Production Deploy and Verify` 是唯一正式 production 部署入口；Railway Production service 保留正式 GitHub repo source，但 GitHub Autodeploy 固定 disabled，workflow 會在 rollback baseline capture 以 Railway API read-only 重驗，避免 main push 繞過 exact-SHA CI、migration evidence 與 rollback gate。本機 CLI 只作查狀態、debug 或緊急修復工具，不作日常 production deploy 入口。workflow 必須先證明同一個 `main` `GITHUB_SHA` 的 `CI` push run 已成功，且不得關閉 release gate或跳過 Web / backend 任一正式 target；partial operation 只能走另有記錄的 emergency procedure。Railway 部署以 code-defined `preDeployCommand` 執行 `backend` 的 `ops:production:predeploy`，直接使用 Railway production service runtime 的 `DATABASE_URL` 完成 migration、chat-context dry-run/apply 與 blocking privacy audit；不得改用另一份 GitHub DB secret作 production mutation。Railway 只在 `/health/ready` 返回 200 後切流，而 readiness 會在實際 runtime DB 驗證本版本的 release-blocking migrations。`ops:release:status` 用於查發布版狀態；`ops:release:gate` 是發布閉環 gate，要求顯式提供 `BACKEND_BASE_URL`、`REDIS_URL`、`ADMIN_JWT_EXPIRES_IN` 以及 `DATABASE_URL` 或 `ENV_FILE`，並禁止 `ALLOW_SIMPLE_LOCK=true`；gate 依序執行 docs contract、backend build/lint、live release status、主站/Admin/backend version commit 對齊 `git rev-parse HEAD`、Vercel 主站/Admin static bundle內的 production `VITE_API_BASE_URL` 對齊 `BACKEND_BASE_URL/api/v1`、backend `/health/live`、`/health/ready`、`/health`，且會解析 `/health` payload 確認 `Lock backend: redis` 與 `AI Stream backend: redis`、DB migration state、release-blocking DB parity、AI pricing catalog、smoke account hygiene、mutating release smoke 與 product-state audit；`ops:release:gate:evidence` 會執行同一個 gate，並把 log / metadata 寫入本機已忽略的 `temp/release-gate-evidence/<run-id>/`，metadata 只記 secret 是否提供，不記 `DATABASE_URL` 或密碼明文；`ops:release:smoke` 會串行執行 `scripts/smoke-production-like.sh` 與 `scripts/smoke-claim-session-production-like.sh`，必須顯式設定 `RUN_MUTATING_RELEASE_SMOKE=true`、release `DATABASE_URL` 與 smoke admin credentials。quick case 建立後，smoke 會以本次 synthetic case 的 exact `case_judgment / quick_single / judgment_draft` scope，在 release DB 逐次輪詢 live backend ledger；只有 `succeeded + completed_at + total_tokens + allocated cost` 齊全，再由 Admin costs API 證明 ledger 未降級，才可通過。此 verifier 不輸出 case/scope ID、metadata、prompt 或 failure text；不得以 pricing config pass 代替 runtime row。主站 quick flow 使用 `FRONTEND_BASE_URL / ORIGIN`，Admin 登入頁與 Admin API 使用 `ADMIN_BASE_URL / ADMIN_ORIGIN`（預設來自 `ADMIN_WEB_URL`），不得把主站 URL 當作 Admin Web；smoke 結尾會再次執行 `ops:smoke-accounts:check`，確認 `claim-smoke-*` 等 active smoke/dev 帳號沒有殘留；`ops:db:status` 用於查當前 `DATABASE_URL` 對應的 Prisma migration state；`ops:release-db:check` 只讀 `_prisma_migrations`，並以 `backend/src/config/release-migrations.ts` 的 `RELEASE_BLOCKING_MIGRATIONS` 作唯一 release-blocking migration catalog，確認全部必須 migration 已完成且未 failed / rolled back；正式文件不得另行硬編 release-blocking migration 數量或清單作完成裁決；`ops:ai-pricing:check` 驗證 `AI_COST_PRICING_JSON` 可解析、帶 `source/version`、`version` 日期未來/過期檢查通過，且覆蓋 `OPENAI_MODEL / OPENAI_INTERVIEW_MODEL / OPENAI_ANALYSIS_MODEL` 與可選 `AI_COST_REQUIRED_MODELS`；`ops:product-state:audit` 用於只讀檢查 case / chat-to-case / repair track replanning 的卡住狀態，輸出產品流、session-bound 分類、repair track AI stream 樣本細節、人工 recovery proposal 與逐筆 `recoveryTasks` 候選；release DB 與 live backend 共用 session-mode pool，這些頂層查詢必須保持 bounded sequential reads，不得以 `Promise.all` 製造連線突發，也不得以 blanket retry 掩蓋真實 finding 或容量錯誤；`ops:product-state:audit:persist` 只在顯式執行時把 recovery task 候選 upsert 到 `product_state_recovery_tasks`，不自動修業務資料；`ops:smoke-accounts:check` 用於只讀掃描 active smoke/dev 帳號污染；`precheck:pairing:normal-uniqueness` 用於只讀檢查一個 user 是否同時出現在多個 `normal pending/active` pairing；Dev DB 已另由 trigger migration 在 DB 層拒絕 cross-role duplicate；`docs:check` 用於確認正式文檔與台賬仍閉環。

Emorapy 命名收斂期內，ops scripts 採新舊 env dual-read：`MAIN_WEB_URL` / `ADMIN_WEB_URL` / `BACKEND_BASE_URL` / `FRONTEND_BASE_URL` / `ADMIN_BASE_URL` / `ORIGIN` / `ADMIN_ORIGIN` / `API_BASE_URL` 舊名仍優先，未提供時可用 `EMORAPY_MAIN_WEB_URL`、`EMORAPY_ADMIN_WEB_URL`、`EMORAPY_BACKEND_BASE_URL`、`EMORAPY_FRONTEND_BASE_URL`、`EMORAPY_ADMIN_BASE_URL`、`EMORAPY_ORIGIN`、`EMORAPY_ADMIN_ORIGIN`、`EMORAPY_API_BASE_URL`；Railway deploy wait 可用 `EMORAPY_RAILWAY_SERVICE_NAME`。`https://emorapy.com` 與 `https://admin.emorapy.com` 是 canonical Production origins，backend 固定為 `https://api.emorapy.com`；workflow preflight 會拒絕其他值，release gate 另以 auth OPTIONS request 驗證兩個 Web origins 的 exact CORS contract。`https://emorapy.vercel.app`、`https://emorapy-admin.vercel.app` 與 Railway legacy hostname只作 compatibility／rollback，不得作正式 release default。

## 2. 平台地圖

| 責任 | 平台 | 固定線索 | 固定查法 |
| --- | --- | --- | --- |
| 主站 Web | Vercel | `.github/workflows/production-deploy-and-verify.yml`、`frontend/vercel.json`、Vercel project secret `VERCEL_MAIN_PROJECT_ID` | `curl https://emorapy.com/version.json` |
| Admin Web | Vercel | `.github/workflows/production-deploy-and-verify.yml`、`frontend-admin/vercel.json`、Vercel project secret `VERCEL_ADMIN_PROJECT_ID` | `curl https://admin.emorapy.com/version.json` |
| 後端 API / jobs / metrics | Railway | `railway.json`、`backend/railway.toml` | `BACKEND_BASE_URL=https://api.emorapy.com npm run ops:release:status` |
| DB | Supabase/Postgres + Prisma | `backend/prisma/schema.prisma`、`backend/prisma/migrations`、`supabase/migrations` | `DATABASE_URL=<db-url> npm run ops:db:status` |
| Source / CI | GitHub + Git | `.github/workflows`、`git` | `git rev-parse HEAD origin/main`、`gh run view <run-id>` |

`.env` 真實值不提交；只提交 `.env.example` 與本 runbook。回答運維問題時，不應輸出 secret，只輸出 host、project、alias、commit、狀態與 masked 訊息。

## 3. 工具授權狀態

CLI 授權是執行當下狀態，不是可長期引用的完成事實。每次要把平台資料作為發布或運維證據前，先跑固定驗證命令；若命令未通過，只能說該平台證據未確認。

| 工具 | 固定驗證命令 | 可作證據 | 備註 |
| --- | --- | --- | --- |
| Vercel CLI | `vercel whoami` | production deployment inspect、臨時 `vercel env pull` | 讀取 production env 後必須清理臨時 env 檔 |
| GitHub CLI | `gh auth status` | workflow / run / repo 狀態 | 只能證明 GitHub 側狀態，不代表平台已發布 |
| Supabase CLI | `supabase projects list` | project ref 與連線目標交叉核對 | production ref：`pfxrglsjgmpfyiwyxzou`；dev ref：`lbukyqztkkkztfrfltlh` |
| Railway CLI | `railway whoami`、`railway status --json` | backend deployment / service 狀態 | 未授權時只能退回 live endpoint 證據，不能聲稱 Railway deployment 已確認 |
| Railway Local MCP | `codex mcp list` 顯示 `railway` enabled | bounded platform reads、logs、domain 與 config 操作 | 使用本機 Railway CLI auth；install/update 後需重開 Codex task |

Railway CLI 若授權失效，在有本機瀏覽器的 Codex/Desktop 環境先用：

```bash
railway login
```

只在 SSH、container 或無法開啟瀏覽器的真正 headless 環境使用 `railway login --browserless`。該流程出現 activation URL/code 後必須立即轉交使用者，並保持原 process 繼續輪詢；逾時後不得沿用舊 code。授權完成後固定驗證：

```bash
railway whoami
railway status --json
```

若 browserless login 長時間等待，不要讓 session 掛起；中止後明確記錄「Railway CLI 仍未授權」。在 Railway CLI 未授權前，只能用 Vercel env 裡的 `VITE_API_BASE_URL` 推導 live backend URL，再用 health/version endpoint 做外部連通驗證，不能聲稱 Railway deployment / logs / service 狀態已被 CLI 確認。

Railway CLI 授權成功後，以 `railway whoami` 的當次輸出作操作者身份證據；正式文件不保存個人帳號授權狀態作長期事實。

## 4. 本機開發版

本機開發版固定由 Localhost 應用構成：

```bash
./scripts/start-dev.sh
```

等效手動啟動時，需先確保 `redis://127.0.0.1:6379` 可用；`./scripts/start-dev.sh` 預設使用 `/tmp/emorapy-redis-dev` 作 Redis 資料目錄，可用 `EMORAPY_DEV_REDIS_DIR` 覆蓋。啟動 backend 時用 `EMORAPY_COMMIT_SHA=$(git rev-parse HEAD)`，避免本機 `/version.commitSha` 回 `unknown`。固定端口為 backend `3001`、主站 `5173`、Admin `5175`、Redis `6379`。

本機 DB 可使用兩種方式：

1. Local Postgres：適合離線與快速試驗。
2. Supabase Dev Postgres：適合資料持久、跨機器共享與避免本機重啟丟資料。

當前固定 Supabase Dev DB：

1. Project name：`Mother Bear Court Dev`
2. Project ref：`lbukyqztkkkztfrfltlh`
3. Region：`eu-west-2`
4. Direct DB host：`db.lbukyqztkkkztfrfltlh.supabase.co`

若使用 Supabase Dev DB，仍屬本機開發版，因為應用 runtime 還是在 Localhost。後端本機 env 應指向 dev DB，不得指向 production DB。

本機開發版固定使用 Supabase Dev DB + 本機 Redis。標準設定：

```env
DATABASE_URL="postgresql://..."
NODE_ENV=development
RUN_MIGRATIONS=false
REDIS_URL=redis://127.0.0.1:6379
ALLOW_SIMPLE_LOCK=false
```

`REDIS_URL=` + `ALLOW_SIMPLE_LOCK=true` 只可作臨時降級；若再次使用，必須同步記入 `07-待處理問題與治理/待處理/`。Railway development Redis 不是本機開發版必要條件，只作可選 parity 增強；發布版仍以 Railway Redis-backed runtime 為正式口徑，且需顯式配置 `ADMIN_JWT_EXPIRES_IN`。

第一次建立 Supabase Dev DB schema 時：

```bash
cd backend
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npm run prisma:seed
```

日常啟動不自動改 schema；有 schema 變更時，先明確跑 migration，再提交 migration 檔。

## 5. 發布版

發布版固定由三件事共同構成：

1. Vercel 主站與 Admin。
2. Railway 後端。
3. Supabase/Postgres production DB。

整體發布版閉環必須同時確認：

1. `HEAD` 與 `origin/main` 是預期 commit。
2. GitHub CI 對該 commit 成功。
3. 主站 `/version.json` 是該 commit。
4. Admin `/version.json` 是該 commit。
5. Railway production backend active deployment 是該 commit，且狀態為 `SUCCESS`。
6. 若本次有 schema 變更，production DB migration state 已確認。
7. health / ready / smoke 通過。

正式 production 部署只走 GitHub Actions：

```bash
gh workflow run "Production Deploy and Verify" --ref main
```

該 workflow 以 GitHub `Production` Environment 作 secret / approval 邊界，先核對 exact SHA 的 CI success，再確認 Railway source repo 對齊且 GitHub Autodeploy disabled，然後以唯一 active `SUCCESS` Railway deployment（而非單純 `latestDeployment`）配合 backend version，捕捉 Railway / backend / Vercel main / Vercel Admin 的既有 deployment id 與 commit SHA 作 rollback baseline。若 latest 是不同 id 的 `FAILED` 嘗試可繼續使用 active baseline；若 latest 仍在 build/deploy/wait 或狀態未知則 fail closed。Railway 正式 service root 為 `/backend`，exact manifest 必須證明 Dockerfile builder / `backend/Dockerfile`；`preDeployCommand` 在 service runtime DB 執行 migration / backfill / privacy audit，通過 `/health/ready` 後才切換 backend 流量。之後 Vercel 先建立 `--skip-domain` staged production build，以 job-level `VERCEL_TOKEN` environment 執行 `vercel curl`，並把 native curl flags 放在 `--` 後；不得再把 `--token` 放進 argv。驗證 staged service 與 exact SHA 後才 promote 主站與 Admin，最後跑 `ops:release:gate:evidence`；Railway up、每次 Vercel promote 與 release gate 前都重驗 `origin/main == GITHUB_SHA`，避免長流程用過時 SHA 覆蓋新 main。若 workflow 沒有執行或 gate 沒有通過，不能把 GitHub push、Vercel Ready 或 Railway health 單獨寫成整體發布閉環。

若 Railway 切流後任一 Vercel promote 或 final release gate 失敗，`rollback-partial-release` 會從 `production-release-previous-state-<run-id>` artifact 讀取 baseline：先對有變更的 Vercel surface 執行 exact deployment Instant Rollback；backend 已改變時，先查 baseline Railway deployment 的 `canRollback` 並核對 project/environment/service scope，再用 Public GraphQL API `deploymentRollback(id)` 原子恢復 baseline image 與 custom variables。live mutation 是 scalar acceptance，流程不能猜測它會回傳新 id；必須輪詢唯一 active `SUCCESS` deployment 已離開失敗版本，再核對 backend commit、endpoint `deploymentId` 與 Railway active id。若 backend 從未切換、但 deploy job 已 stamp 新 commit marker，才以 `--skip-deploys` 恢復 `EMORAPY_COMMIT_SHA`。HTTP／GraphQL failure 需保存已 sanitize 的 error body；恢復證據寫入 `production-release-rollback-<run-id>`，任何 surface 無法恢復時 workflow 必須保持失敗。此流程不執行 production DB down migration，資料庫只允許 expand-only、可與 rollback runtime 相容的 migration。

Production workflow 的固定 GitHub Variables：

| Key | 用途 |
| --- | --- |
| `VERCEL_ORG_ID` | Vercel team / org id |
| `VERCEL_MAIN_PROJECT_ID` | 主站 Vercel project id |
| `VERCEL_ADMIN_PROJECT_ID` | Admin Vercel project id |
| `EMORAPY_BACKEND_BASE_URL` / `PRODUCTION_BACKEND_BASE_URL` | Railway production backend base URL；release gate workflow 先讀 Emorapy 新名，再 fallback 舊 production 變數 / secret |
| `EMORAPY_MAIN_WEB_URL` / `PRODUCTION_MAIN_WEB_URL` | 主站 production URL；release gate workflow 先讀 Emorapy 新名，再 fallback legacy var / Emorapy Vercel project-domain default |
| `EMORAPY_ADMIN_WEB_URL` / `PRODUCTION_ADMIN_WEB_URL` | Admin production URL；release gate workflow 先讀 Emorapy 新名，再 fallback legacy var / Emorapy Vercel project-domain default |
| `EMORAPY_RAILWAY_SERVICE_NAME` / `PRODUCTION_RAILWAY_SERVICE` | Railway production service name；production workflow 先讀 Emorapy 新名，再 fallback 舊 deployment var / legacy default |

Production workflow 的固定 GitHub Secrets：

| Key | 用途 |
| --- | --- |
| `VERCEL_TOKEN` | Vercel CLI production deploy |
| `RAILWAY_API_TOKEN` 或 `RAILWAY_TOKEN` | Railway CLI production deploy |
| `PRODUCTION_RAILWAY_PROJECT_ID` 或既有 project id secret | Railway project id；同一 Railway project 可同時部署 production environment |
| `PRODUCTION_DATABASE_URL` 或 `APP_RELEASE_DATABASE_URL` | release gate 的獨立 DB parity / smoke 證據；production mutation 使用 Railway service runtime `DATABASE_URL` |
| `PRODUCTION_REDIS_URL` | release gate 驗 Redis-backed runtime |
| `PRODUCTION_ADMIN_JWT_EXPIRES_IN` | release gate 驗 Admin token expiry policy |
| `RELEASE_SMOKE_ADMIN_EMAIL` / `RELEASE_SMOKE_ADMIN_PASSWORD` | mutating release smoke 專用 Admin 帳號 |

缺任一必要 secret 時，workflow 必須 fail fast；不得用本機 `.env`、staging secret 或手寫 console 輸出補齊正式發布證據。

固定 gate：

```bash
RUN_MUTATING_RELEASE_SMOKE=true \
BACKEND_BASE_URL=<railway-backend-url> \
ADMIN_WEB_URL=<admin-web-url> \
DATABASE_URL="<prod-db-url>" \
RELEASE_SMOKE_ADMIN_EMAIL=<admin-email> \
RELEASE_SMOKE_ADMIN_PASSWORD=<admin-password> \
npm run ops:release:gate:evidence
```

如用臨時 env 檔，使用 `ENV_FILE=<path>` 代替直接輸出 `DATABASE_URL`。`ops:release:gate` 故意不自動讀取 `backend/.env`，避免把本機開發版 DB 誤當發布版 DB 完成閉環。真實發布閉環優先由 GitHub Actions production workflow 跑 `ops:release:gate:evidence` 並上傳 artifact；本機執行只作排查或緊急驗證，且 evidence 目錄在 `.gitignore` 範圍內，不能提交包含 secret 的 log。

`RUN_MUTATING_RELEASE_SMOKE=true` 是故意的顯式開關：release smoke 會建立 quick session / quick case、登入 smoke admin、註冊 `claim-smoke-*` user、讀 release DB verification code 並驗證 claim-session 歸戶。未設定此開關時，完整 release gate 必須失敗，不得把健康檢查當作主鏈路 smoke。主站 URL 與 Admin URL 分離：`FRONTEND_BASE_URL` 預設主站，`ADMIN_BASE_URL` 預設 `ADMIN_WEB_URL`；Admin API request 使用 `ADMIN_ORIGIN`。`ops:release:smoke` 結尾會再次跑 active smoke/dev 帳號 hygiene；若 cleanup 失敗或專用 smoke admin 誤用了預設 smoke admin，發布 gate 必須失敗。

`scripts/smoke-claim-session-production-like.sh` 預設會在結束時停用本次建立的 `claim-smoke-*` user（`CLAIM_SMOKE_DISABLE_CREATED_USER=true`）。若因特殊排查需要保留 smoke user，必須明確設為 `false`，並在排查後手動停用或刪除。

發布後掃描 active smoke / dev 測試帳號：

```bash
cd backend
npm run ops:smoke-accounts:check
```

此命令預設只讀，若發現 `claim-smoke-*`、預設 dev user 或預設 smoke/admin user 仍啟用，會以非 0 exit code 阻斷發版閉環。僅在確認目標 DB 與帳號範圍後，才可用 `SMOKE_ACCOUNT_HYGIENE_DISABLE=true npm run ops:smoke-accounts:check` 停用白名單匹配帳號。

`ops:release:gate` 會硬性要求三個 version endpoint 的 `service` 與 `commitSha` 對齊本機 `HEAD`；如果 backend 還是舊部署、未回傳 `commitSha` 或任何一端仍是舊 commit，gate 必須失敗。缺任何一項時，應說「部分已發布」並列明缺口，不應說整體已最新。

App telemetry runtime release evidence 也使用版本對齊規則：`npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local` 執行時必須先讓 release backend `/version.commitSha` 等於本地 `HEAD`，才會送 App event / OTLP payload；版本不對齊時只能產生 blocked evidence，不能解除 `telemetry_runtime_evidence`。該 evidence 納入 release audit 後，允許後續只追加 docs / evidence commit；但若 evidence backend commit 不是目前 `HEAD` 的祖先，或該 commit 後改過 backend telemetry/version runtime 路徑，舊 evidence 必須失效並重跑。

## 5.1 產品狀態一致性與恢復提案

排查卡住的判決生成、chat-to-case 轉換、缺失判決連結或 repair replan AI stream 時，固定先跑：

```bash
cd backend && npm run ops:product-state:audit
```

輸出語義：

1. `checks[].count`：該類不一致或卡住狀態的數量。
2. `checks[].sampleIds`：最多 20 個樣本 ID，供人工查詢。
3. `checks[].sampleDetails`：最多 20 個樣本的產品流與關聯上下文；case 與 `chat_to_case_link` linked case 樣本包含 `productFlow / mode / status / sessionBound`，其中 `sessionBound` 必須使用 `case-classifier` 的 `isSessionBoundCase()`，不得只看裸 `session_id`；chat-to-case 樣本包含 `roomId / caseId / judgmentId / linkedCaseIds`，repair track 樣本包含 `planId / caseId / judgmentId / latestStreamId / latestStreamStatus` 等人工排查線索。
4. `checks[].recoveryProposal`：當 count > 0 時提供該類問題的人工恢復建議；當 count = 0 時為 `null`。
5. `checks[].recoveryTasks[]`：當 count > 0 時為每個 sample 生成機器可讀的人工任務候選，包含 `id / proposalId / status / severity / entityType / entityId / productFlow / linkedEntityIds / recommendedAction / verificationCommands / guardrails / source`。
6. `recoveryTasks[].status` 固定為 `manual_review_required`；`automaticFixAvailable=false` 且 `requiresHumanApproval=true`，表示此命令不會、也不應自動修改資料。
7. `recoveryProposal.automaticFixAvailable` 固定為 `false`，`recoveryProposal.requiresHumanApproval` 固定為 `true`，任何 production data 寫入前必須先建立待處理任務或工單。

需要持久化人工任務候選時，固定跑：

```bash
cd backend && npm run ops:product-state:audit:persist
```

此命令只 upsert `product_state_recovery_tasks`，不改 case / chat / judgment / repair 資料。Release DB 套用 `20260504173000_add_product_state_recovery_tasks` 前，不得在發布版使用 persist 模式。

Admin 後端人工 workflow 已提供兩個只操作 recovery task 自身的接口：

1. `GET /api/v1/admin/product-state/recovery-tasks`：需要 `ops:read`，可按 `status / severity / entity_type / entity_id / product_flow / source / proposal_id` 查詢，返回 `items / total / limit / offset / summary.byStatus / summary.bySeverity`。
2. `PATCH /api/v1/admin/product-state/recovery-tasks/:taskId/status`：需要 `ops:execute`，只允許把任務標記為 `manual_review_required / in_review / resolved / dismissed`，並寫入 `audit_logs(entity_type=product_state_recovery_task, action=update_status)`；`resolved` 只寫 `resolved_at`，`dismissed` 只寫 `dismissed_at`，不修改任何 case / chat / judgment / repair row。

禁止事項：

1. 不得只憑 audit proposal 直接更新 production row。
2. 不得只修改 `chat_rooms.status` 而不核對 `chat_to_case_links / cases / judgments`。
3. 不得把 `cases.status=in_progress` 直接改成 `completed`；必須先確認是否已有唯一 judgment 或仍有 active AI stream。
4. 不得把 `repair_tracks.status=replanning` 直接改回 active；必須先核對最新 `ai_stream_sessions / ai_stream_events`、新 plan version 與 step progress 是否已完整落庫。

## 6. Vercel 固定查法

查主站與 Admin：

```bash
EMORAPY_MAIN_WEB_URL=https://emorapy.com EMORAPY_ADMIN_WEB_URL=https://admin.emorapy.com EMORAPY_BACKEND_BASE_URL=https://api.emorapy.com npm run ops:release:status
```

若 CLI 未登入或 project link 不確定，先以 `/version.json` 回報的 commit 作最低證據，再補 CLI inspect。

Production workflow 中 `vercel pull --environment=production` 會把平台 env 寫到 `.vercel/.env.production.local`，但 Vite build 不會自動讀該路徑；`scripts/import-vercel-public-env.mjs` 必須只抽取 public `VITE_*`，同步寫入 app 目錄 `.env.production.local` 與 `GITHUB_ENV`。主站 build 前必須確認 `.env.production.local` 含 `VITE_API_BASE_URL`；release gate 會用 `scripts/check-vercel-static-env.mjs` 抓 live HTML/JS bundle，確認主站與 Admin bundle 內含 `BACKEND_BASE_URL/api/v1`，再以 `scripts/check-release-origin-contract.mjs` 驗證 canonical main/Admin origins 的 auth CORS preflight，避免 version endpoint 綠燈但前端 runtime 不可用。

補充查 production backend URL：

```bash
tmpdir=$(mktemp -d /tmp/cj-vercel-env.XXXXXX)
vercel env pull "$tmpdir/main.env" --environment=production
```

只讀取 `VITE_API_BASE_URL` 的 host/path，避免輸出其他 secret；用完刪除臨時目錄。

## 7. Railway 固定查法

Railway 是後端 runtime 平台；唯一正式 production 發布入口仍是 GitHub Actions `Production Deploy and Verify`。先查 CLI 狀態：

```bash
railway whoami
railway status --json
```

### 7.1 Codex 管理面：CLI + Local MCP + Railway skill

本項目採用官方本機組合，不引入第三方 Railway connector：

```bash
npm update -g @railway/cli
railway mcp install --agent codex
railway skills install --agent codex
codex mcp list
```

2026-07-14 已以 Railway CLI `5.26.1` 完成安裝：Local MCP 寫入 Codex config，`use-railway` skill 寫入 Codex skills directory。安裝或更新後必須新開 Codex task 才能載入新工具；`codex mcp list` 只證明 config enabled，不代表當前舊 session 已可調用。

固定路由與邊界：

1. 需要 current repo/linkage、exact JSON output、local debug 或 SSH 時用 Railway CLI；使用 MCP 作 project/service discovery、bounded logs/metrics/domain/status 查詢。
2. 每次 mutation 前明確核對 project `Emorapy`、environment `production` 與 service `emorapy-api`；不依賴隱式 linked context 去修改資源。
3. 本機 MCP/CLI 不是 production release authority；日常發布、redeploy、rollback 與發布期 variables 變更必須走正式 workflow 或已記錄的 emergency procedure，不直接執行 `railway up`。
4. 讀取或修改 variables 時只報告 key/presence/masked status，不輸出 variable payload 或把 secret 寫入 shell transcript、repo 與 evidence artifact。
5. Remote MCP 與 GraphQL 不是預設路徑；只在本機 CLI/MCP 未覆蓋操作，且已重新核對 OAuth/token scope 與變更影響後才使用。

若 CLI 回覆 unauthorized，不要猜後端已部署；改用 live backend URL 查：

```bash
EMORAPY_BACKEND_BASE_URL=https://<backend-domain> npm run ops:release:status
```

Railway production 後端是否最新，必須以 deployment 狀態或後端 version endpoint 確認，不能由 Vercel 狀態推導。

判斷目前承接流量的 Railway runtime 時，以精確 environment/service 下唯一 `activeDeployments` `SUCCESS` 為準，並與 backend `/version.deploymentId`（新版 runtime）交叉核對；`latestDeployment` 可能只是 failed 或尚未切流的部署嘗試，不能單獨當成 current。正式 workflow 另要求 GitHub Autodeploy disabled；若平台被重新開啟，先停止發布並恢復單一 deployment owner，不得讓 main push 與 workflow `railway up` 競態執行。

`https://api.emorapy.com` 已於 2026-07-14 由 `railway domain list --service emorapy-api --environment production --json` 確認 `syncStatus=ACTIVE`，且 HTTPS `/version` 可讀、`/health/ready` 回 200。這只證明 domain/TLS/runtime 可用，不等於跨層 URL variables 與正式發布已切換。live backend URL 應由 production URL contract 或當次 release status 取得；以下 legacy Railway domain 只作 compatibility/rollback 候選入口：

```text
https://mother-bear-court-production.up.railway.app
```

後端 `/health`、`/health/ready`、`/health/live`、`/version` 與 `/api/v1/version` 可作外部連通證據；`/version` 與 `/api/v1/version` 會回傳 `service / version / commitSha / commitShortSha / deploymentId / timestamp`，`deploymentId` 取自 Railway runtime `RAILWAY_DEPLOYMENT_ID`，非 Railway 環境可為 `null`。若 production `commitSha` 為 `unknown`、缺失或未對齊本機 `HEAD`，或 `deploymentId` 與 exact Railway deployment 不一致，不得聲稱 Railway backend 已發布到最新 commit。

Railway production backend 是否最新，必須用當次查詢裁決：

1. 完整發布閉環優先跑 `BACKEND_BASE_URL=<backend-url> DATABASE_URL="<prod-db-url>" npm run ops:release:gate`。
2. 單點排查至少核對 backend `/version.commitSha` 與本機 `HEAD`。
3. 需要 deployment / log 證據時補 `railway status --json`。
4. Vercel 狀態、候選 backend domain 或單純 health endpoint 都不能推導 Railway backend 已發布到最新 commit。

## 8. Supabase / DB 固定查法

查 DB migration state：

```bash
DATABASE_URL="postgresql://..." npm run ops:db:status
DATABASE_URL="postgresql://..." npm --prefix backend run ops:release-db:check
```

或從指定 env file 載入：

```bash
ENV_FILE=<backend-local-env-file> npm run ops:db:status
```

固定安全規則：

1. `ops:db:status` 不輸出 `DATABASE_URL`，只輸出 host、database、user 與 migration 狀態。
2. production migration 不靠本機開發啟動自動執行。
3. `backend/src/config/database.ts` 只有在 `RUN_MIGRATIONS=true` 時，production 啟動才會執行 `prisma migrate deploy`。
4. 對 production DB 執行任何寫入或 migration 前，必須先確認本次 schema 變更、回退方案與執行窗口。

DB 核驗口徑：

1. 本機後端 env、Vercel env 與 Supabase project ref 只能識別目標環境；不能證明 migration readiness。
2. Dev DB `Database schema is up to date!` 或本機 `ops:release-db:check` 通過，只能證明 development target；不能外推 production DB。
3. 發布版 DB readiness 必須使用當次 release `DATABASE_URL` 執行 `npm run ops:db:status` + `npm --prefix backend run ops:release-db:check`，或直接跑完整 `npm run ops:release:gate`。
4. release-blocking migration 清單以 `backend/scripts/check-release-db-parity.ts` 的 `RELEASE_BLOCKING_MIGRATIONS` 為唯一來源；若該 catalog、新 migration、schema 或 production target 變更，舊 DB evidence 必須失效並重跑。
5. 需要保存正式證據時，使用 `DATABASE_URL="<release-or-production-url>" npm --prefix backend run ops:release-db:evidence`；evidence 只記 target classification、provider/source/local classification 與 migration report，不記 host、密碼或完整 `DATABASE_URL`。

## 9. Git / CI 固定查法

查本機與遠端 commit：

```bash
git status -sb
git rev-parse HEAD
git rev-parse origin/main
```

查 CI：

```bash
gh run view <run-id> --json conclusion,status,headSha,url,createdAt,updatedAt
```

若要回答「是否已推送」：

1. `HEAD == origin/main` 才能說本機 commit 已推到遠端。
2. CI success 才能說該 commit 通過 gate。
3. Vercel/Railway/DB 都確認後，才能說發布版閉環。

## 10. `.env` 分層

| 文件 | 用途 | 可提交 |
| --- | --- | --- |
| `backend/.env.example` | 後端本機 env 範本 | 是 |
| `frontend/.env.example` | 主站本機 env 範本 | 是 |
| `frontend-admin/.env.example` | Admin 本機 env 範本 | 是 |
| 後端本機 env 文件 | 本機實際 secret / DB URL | 否 |
| 主站本機 env 文件 | 本機實際 Web env | 否 |
| Admin 本機 env 文件 | 本機實際 Admin env | 否 |
| Vercel env | Vercel dashboard / CLI 管理 | 否 |
| Railway env | Railway dashboard / CLI 管理 | 否 |
| Supabase DB password / URL | Supabase dashboard 管理 | 否 |

禁止把 production secret 放進 repo。需要記錄平台資訊時，只記 project name、alias、host、用途與查法，不記密碼或 token。

後端 AI request ledger 的 request-level 成本歸因由可選 env `AI_COST_PRICING_JSON` 控制，格式固定為：

```env
AI_COST_PRICING_JSON={"source":"manual-openai-pricing","version":"YYYY-MM-DD","models":{"gpt-3.5-turbo":{"inputUsdPer1M":0,"outputUsdPer1M":0},"gpt-4o-mini":{"inputUsdPer1M":0,"outputUsdPer1M":0},"gpt-4o":{"inputUsdPer1M":0,"outputUsdPer1M":0}}}
AI_COST_PRICING_MAX_AGE_DAYS=30
```

運維規則：

1. Localhost backend 與 Railway release backend 的 `AI_COST_PRICING_JSON` 必須分別配置；本機 `.env` 不代表發布版已配置。
2. 未配置、provider/model 未命中或 provider 未回 token usage 時，ledger `cost_usd=null`，Admin costs `openai.ledger.productFlows[].costSource` 會是 `not_allocated`。
3. 查成本閉環時，若預期應有精準成本但仍看到 `not_allocated`，優先檢查 Railway env 的 `AI_COST_PRICING_JSON` 是否缺失、model key 是否與 runtime model 完全一致、pricing `version` 是否為當前審核版本。
4. `ops:ai-pricing:check` 與 `ops:release:gate` 會硬性校驗 pricing catalog，缺 `source/version`、JSON 無效、`version` 不以 `YYYY-MM-DD` 開頭、日期在未來、超過 `AI_COST_PRICING_MAX_AGE_DAYS` 或缺少 runtime model 任一項都會阻塞 gate；若新增模型但不是三個標準 env，可用 `AI_COST_REQUIRED_MODELS` 追加必須覆蓋的 model key。
5. `ops:release:gate` 會設定 `EMORAPY_RELEASE_GATE=1`，此時 `backend/scripts/check-ai-pricing-catalog.ts` 不載入本機 `backend/.env`；發布 pricing 必須來自顯式 env / `ENV_FILE` / 平台 release env，避免本機開發版 pricing 讓發布 gate 假通過。
6. `ops:ai-pricing:check` 只證明 catalog 可用；正式發布還必須由 `ops:release:smoke` 觸發 live `judgment_draft`，以 `ops:ai-ledger:runtime:check` 證明 exact synthetic case 已成功落庫、完成、記錄 token/cost，並由 `/api/v1/admin/reports/costs` 證明 `quick_single` breakdown 可讀。不得只查 24 小時 aggregate 後推斷本次 runtime 正常。
7. AI pricing / Admin costs release 產證流程：見 [../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Runbook-2026-05-12.md](../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Runbook-2026-05-12.md)

## 11. Agent 回答口徑

固定用語：

1. 「已推送」= commit 已到 `origin/main`。
2. 「主站已發布」= Vercel 主站 production 指向該 commit。
3. 「Admin 已發布」= Vercel Admin production 指向該 commit。
4. 「後端已發布」= Railway production 指向該 commit，且 live version / health 正常。
5. 「DB 已更新」= migration state 已在目標 DB 確認。
6. 「整體最新」= Web、Admin、Backend、DB、CI 全部一致。

若權限不足，例如 Railway CLI 未登入或無法讀 Supabase production，必須明確說「不能確認」，不得用推論補齊。
