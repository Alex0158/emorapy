# 運維連接與調用Runbook

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：Vercel、Railway、Supabase/Postgres、Git/GitHub 與本機 `.env` 的固定連接、查詢與發布操作口徑
**取證代碼入口**：`package.json`、`scripts/ops-release-status.sh`、`scripts/ops-db-status.sh`、`backend/.env.example`、`frontend/.env.example`、`frontend-admin/.env.example`、`backend/railway.toml`、`backend/prisma/schema.prisma`、`backend/src/config/database.ts`
**最後核驗 Commit**：`6053d09`
**最後核驗日期**：`2026-05-03`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文件固定 agent 與開發者連接平台、查版本、查資料庫與判定發布狀態的方法。目標是讓日常運維不依賴臨場記憶，也不靠重複試錯。

## 1. 固定入口

優先使用 repo 內命令：

```bash
npm run ops:release:status
npm run ops:db:status
cd backend && npm run ops:product-state:audit
cd backend && npm run precheck:pairing:normal-uniqueness
npm run docs:check
```

`ops:release:status` 用於查發布版狀態；`ops:db:status` 用於查當前 `DATABASE_URL` 對應的 Prisma migration state；`ops:product-state:audit` 用於只讀檢查 case / chat-to-case / repair track replanning 的卡住狀態，輸出產品流、repair track AI stream 樣本細節與人工 recovery proposal；`precheck:pairing:normal-uniqueness` 用於只讀檢查一個 user 是否同時出現在多個 `normal pending/active` pairing；`docs:check` 用於確認正式文檔與台賬仍閉環。

## 2. 平台地圖

| 責任 | 平台 | 固定線索 | 固定查法 |
| --- | --- | --- | --- |
| 主站 Web | Vercel | `vercel.json`、Vercel CLI project link | `curl https://mother-bear-court.vercel.app/version.json` |
| Admin Web | Vercel | `frontend-admin/vercel.json`、Vercel CLI project link | `curl https://frontend-admin-sigma-virid.vercel.app/version.json` |
| 後端 API / jobs / metrics | Railway | `railway.json`、`backend/railway.toml` | `BACKEND_BASE_URL=<backend-url> npm run ops:release:status` |
| DB | Supabase/Postgres + Prisma | `backend/prisma/schema.prisma`、`backend/prisma/migrations`、`supabase/migrations` | `DATABASE_URL=<db-url> npm run ops:db:status` |
| Source / CI | GitHub + Git | `.github/workflows`、`git` | `git rev-parse HEAD origin/main`、`gh run view <run-id>` |

`.env` 真實值不提交；只提交 `.env.example` 與本 runbook。回答運維問題時，不應輸出 secret，只輸出 host、project、alias、commit、狀態與 masked 訊息。

## 3. 工具授權狀態

最後核驗：`2026-05-03`。

| 工具 | 狀態 | 固定驗證命令 | 備註 |
| --- | --- | --- | --- |
| Vercel CLI | 已授權 | `vercel whoami` | 可 inspect production deployment，也可 `vercel env pull` 臨時讀取 production env；讀完需清理臨時 env 檔 |
| GitHub CLI | 已授權 | `gh auth status` | 可查 workflow / run / repo 狀態 |
| Supabase CLI | 已授權 | `supabase projects list` | production ref：`pfxrglsjgmpfyiwyxzou`；dev ref：`lbukyqztkkkztfrfltlh` |
| Railway CLI | 已授權 | `railway whoami` | `railway project list` 與 `railway status --json` 可用 |

Railway CLI 若授權失效，重新授權流程：

```bash
railway login --browserless
```

CLI 會顯示 activation code。打開 `https://railway.com/activate` 並輸入該 code。授權完成後固定驗證：

```bash
railway whoami
railway status --json
```

若 browserless login 長時間等待，不要讓 session 掛起；中止後明確記錄「Railway CLI 仍未授權」。在 Railway CLI 未授權前，只能用 Vercel env 裡的 `VITE_API_BASE_URL` 推導 live backend URL，再用 health/version endpoint 做外部連通驗證，不能聲稱 Railway deployment / logs / service 狀態已被 CLI 確認。

目前 Railway CLI 已於 `2026-05-03` 授權成功，帳號為 `Chon Wang Wong(Alex) (uk.alex.wong.uk@gmail.com)`。

## 4. 本機開發版

本機開發版固定由 Localhost 應用構成：

```bash
cd backend && npm run dev
cd frontend && npm run dev
cd frontend-admin && npm run dev
```

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

`REDIS_URL=` + `ALLOW_SIMPLE_LOCK=true` 只可作臨時降級；若再次使用，必須同步記入 `07-待處理問題與治理/待處理/`。Railway development Redis 不是本機開發版必要條件，只作可選 parity 增強；發布版與 staging 仍以 Railway Redis-backed runtime 為正式口徑。

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

缺任何一項時，應說「部分已發布」並列明缺口，不應說整體已最新。

## 5.1 產品狀態一致性與恢復提案

排查卡住的判決生成、chat-to-case 轉換、缺失判決連結或 repair replan AI stream 時，固定先跑：

```bash
cd backend && npm run ops:product-state:audit
```

輸出語義：

1. `checks[].count`：該類不一致或卡住狀態的數量。
2. `checks[].sampleIds`：最多 20 個樣本 ID，供人工查詢。
3. `checks[].sampleDetails`：最多 20 個樣本的產品流與關聯上下文；case 樣本包含 `productFlow / mode / status / sessionBound`，chat-to-case 樣本包含 `roomId / caseId / judgmentId / linkedCaseIds`，repair track 樣本包含 `planId / caseId / judgmentId / latestStreamId / latestStreamStatus` 等人工排查線索。
4. `checks[].recoveryProposal`：當 count > 0 時提供人工恢復建議；當 count = 0 時為 `null`。
5. `recoveryProposal.automaticFixAvailable` 固定為 `false`，表示此命令不會、也不應自動修改資料。
6. `recoveryProposal.requiresHumanApproval` 固定為 `true`，任何 production data 寫入前必須先建立待處理任務或工單。

禁止事項：

1. 不得只憑 audit proposal 直接更新 production row。
2. 不得只修改 `chat_rooms.status` 而不核對 `chat_to_case_links / cases / judgments`。
3. 不得把 `cases.status=in_progress` 直接改成 `completed`；必須先確認是否已有唯一 judgment 或仍有 active AI stream。
4. 不得把 `repair_tracks.status=replanning` 直接改回 active；必須先核對最新 `ai_stream_sessions / ai_stream_events`、新 plan version 與 step progress 是否已完整落庫。

## 6. Vercel 固定查法

查主站與 Admin：

```bash
curl -fsS https://mother-bear-court.vercel.app/version.json
curl -fsS https://frontend-admin-sigma-virid.vercel.app/version.json
vercel inspect https://mother-bear-court.vercel.app
vercel inspect https://frontend-admin-sigma-virid.vercel.app
```

若 CLI 未登入或 project link 不確定，先以 `/version.json` 回報的 commit 作最低證據，再補 CLI inspect。

補充查 production backend URL：

```bash
tmpdir=$(mktemp -d /tmp/cj-vercel-env.XXXXXX)
vercel env pull "$tmpdir/main.env" --environment=production
```

只讀取 `VITE_API_BASE_URL` 的 host/path，避免輸出其他 secret；用完刪除臨時目錄。

## 7. Railway 固定查法

Railway 是後端發布入口。先查 CLI 狀態：

```bash
railway whoami
railway status --json
```

若 CLI 回覆 unauthorized，不要猜後端已部署；改用 live backend URL 查：

```bash
BACKEND_BASE_URL=https://<backend-domain> npm run ops:release:status
```

Railway production 後端是否最新，必須以 deployment 狀態或後端 version endpoint 確認，不能由 Vercel 狀態推導。

當前 live backend URL 可由 Vercel production env 的 `VITE_API_BASE_URL` 取得；最近核驗為：

```text
https://mother-bear-court-production.up.railway.app
```

後端 `/health`、`/health/ready`、`/health/live`、`/version` 與 `/api/v1/version` 可作外部連通證據；但當前後端 version endpoint 只回 `version/timestamp`，不回 commit SHA，因此不能單靠 endpoint 嚴格證明 Railway backend 與 git commit 完全一致。

`2026-05-03` Railway production backend 實測狀態：

1. Project：`ingenious-commitment`
2. Service：`mother-bear-court`
3. Latest deployment status：`SUCCESS`
4. Active deployment status：`SUCCESS`
5. Production backend domain：`https://mother-bear-court-production.up.railway.app`
6. Railway CLI 可用 `railway status --json` 取得 exact active commit。

因此，判斷後端是否最新時，應以 `railway status --json` 的 production `mother-bear-court` latest/active deployment commit 與 status 為準；不能只靠 Vercel 或後端 `/version` endpoint 推導。

## 8. Supabase / DB 固定查法

查 DB migration state：

```bash
DATABASE_URL="postgresql://..." npm run ops:db:status
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

最近核驗結果：

1. 本機後端 env 指向 Supabase dev direct host `db.lbukyqztkkkztfrfltlh.supabase.co`，屬 development env。
2. Vercel production env 的 `DATABASE_URL` 指向 Supabase production pooler host `aws-1-eu-west-2.pooler.supabase.com`。
3. `2026-05-03` 已對 production Supabase/Postgres 套用以下 migration：
   - `20260502095500_add_admin_governance_models`
   - `20260502102000_add_judgment_emotional_analysis`
   - `20260502103000_add_reconciliation_repair_models`
4. `2026-05-03` 已刪除舊 dev Supabase project，重建 `Mother Bear Court Dev`（ref：`lbukyqztkkkztfrfltlh`），並套用全部 11 個 Prisma migrations。
5. 新 dev DB 未執行 seed；業務資料表為 0 筆資料，只保留 migration history。
6. Production pooler 與 dev DB 兩個連線視角均回報 `Database schema is up to date!`。

若之後新增 migration，仍必須重新執行 `ops:db:status`；不能沿用本段歷史結論。

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

## 11. Agent 回答口徑

固定用語：

1. 「已推送」= commit 已到 `origin/main`。
2. 「主站已發布」= Vercel 主站 production 指向該 commit。
3. 「Admin 已發布」= Vercel Admin production 指向該 commit。
4. 「後端已發布」= Railway production 指向該 commit，且 live version / health 正常。
5. 「DB 已更新」= migration state 已在目標 DB 確認。
6. 「整體最新」= Web、Admin、Backend、DB、CI 全部一致。

若權限不足，例如 Railway CLI 未登入或無法讀 Supabase production，必須明確說「不能確認」，不得用推論補齊。
