# Emorapy 命名收斂剩餘任務 Codex 交接執行單

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Emorapy 命名收斂尚未閉環、需使用者外部操作或 Codex repo 內 gated 執行的剩餘任務交接 spec
**取證代碼入口**：`mobile/scripts/sync-release-github-secrets.mjs`、`mobile/scripts/check-release-github-secret-names.mjs`、`scripts/check-emorapy-naming-governance.mjs`、`scripts/check-docs-truth.mjs`、`scripts/check-docs-structure.mjs`、`.github/workflows/production-deploy-and-verify.yml`
**最後核驗 Commit**：`c78765b`
**最後核驗日期**：`2026-07-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：T1 GitHub repo rename 已由 Codex CLI 執行為 `Alex0158/emorapy`，本地 `origin` 已更新，`EMORAPY_GITHUB_REPO=Alex0158/emorapy` 已設為 GitHub repo variable；2026-06-22 Codex 已把 Vercel projects rename 為 `emorapy` / `emorapy-admin`，新增並驗證 `https://emorapy.vercel.app`、`https://emorapy-admin.vercel.app` production project domains，且設置 GitHub repo variables `EMORAPY_MAIN_WEB_URL` / `EMORAPY_ADMIN_WEB_URL`；T1 backend domain migration 仍待 Railway alias / domain / release evidence / T1-L 本地 workspace 與檔名路徑命名收斂已納入 / T2 PRD ID 遷移已於 2026-06-21 gated 執行完成 / 待外部憑證與證據（T3 App release 命名相關 evidence）；T1 backend domain、T1-L、T3 未達成前，本交接單整體仍不得標為已處理/已閉環/已完成
**Owner**：Product / Ops / Mobile / Docs（與 Codex 協作）
**關聯核心文件**：`07-待處理問題與治理/待處理/Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md`、`07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md`、`03-管理端與平台治理/05-運維連接與調用Runbook.md`、`術語表.md`、`00-跨端產品核心/01-產品PRD總章.md`

---

## 用途與讀法

本文件是「Emorapy 命名收斂」尚未閉環、且**需要外部平台操作、使用者配合或需要一個獨立 gated 執行輪**的剩餘任務交接單，供使用者與 Codex 一起接手。

已完成、且已有防回流 gate 的部分（dev-facing 範本收斂、gate 盲區加固、`CJ_*` env deprecation、P2 對外文案、P3 package scope、P5 docs allowlist 等）見 `Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md`，本文件不重複。

每個任務（T1/T1-L/T2/T3）都用同一結構描述：目標、執行角色、前置依賴、詳細步驟、驗證命令、完成判定（DoD）、停止/回滾條件、禁止事項。命令以 repo 根目錄為工作目錄，除非另有標註。

通則（三個任務都適用）：

1. 不得用 `sed -i 's/CJ/Emorapy/g'` 類全局搜尋替換；每一處改動都要先判定 allowlist 分類。
2. 不得改寫 `07/已處理/`、`90-證據與盤點/`、`99-歷史降級索引/`、`文件收斂/` 的歷史原文（P6 邊界）。
3. 不得在文件、commit、log 中輸出任何 secret；只記 key name、presence、masked 值、commit SHA、host、project 名。
4. 每輪結束都要跑 `npm run naming:check` 與 `npm run docs:check`，並保持 App `release:completion:audit` 的 incomplete 判定不被任何命名輪誤標為完成。

---

## T1：GitHub repo 改名與 domain 遷移（使用者外部執行 + Codex 收尾）

### 目標

把 repo / 部署入口從 legacy `mother-bear-court`（GitHub repo、Vercel `mother-bear-court.vercel.app`、Railway `mother-bear-court-production.up.railway.app`）遷移到 Emorapy 正式 repo 名與 domain，並把正式入口從 legacy hostname 切到 Emorapy domain。

### 執行角色

1. 外部平台操作（GitHub / Vercel / Railway 後台）：**使用者**；若 CLI / browser session 已具備足夠權限，可由 **Codex** 先執行可逆或低風險步驟並回報證據。
2. repo 內 remote 更新、variable 文檔化、platform map / AGENTS.md 收尾、驗證：**Codex**。

### 前置依賴與 repo 內就緒狀態（已驗證，無待改 code）

1. App release GitHub secret 工具解析 repo 順序為 `--repo=<owner/repo>` > `EMORAPY_GITHUB_REPO` > `GITHUB_REPOSITORY` > default `Alex0158/emorapy`（見 `mobile/scripts/check-release-github-secret-names.mjs`、`mobile/scripts/sync-release-github-secrets.mjs`）。
2. `.github/workflows/*.yml` 使用 `${{ github.* }}` context 與 repo / environment variables，未硬編 repo slug。
3. Railway service 名與 main/admin/backend URL 可由 `EMORAPY_RAILWAY_SERVICE_NAME`、`EMORAPY_MAIN_WEB_URL`、`EMORAPY_ADMIN_WEB_URL`、`EMORAPY_BACKEND_BASE_URL` 覆蓋 legacy default。
4. legacy hostname 已被 naming gate 與 runbook 分類為 compatibility default，不是正式 Emorapy domain 完成證據。

詳見 `Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md` 的「P4 GitHub repo / domain rename runbook」。

### 詳細步驟

1. **先加 domain alias，不切主入口（使用者 / Codex）**：
   - Vercel：2026-06-22 Codex 已為 main/admin project 加入 `emorapy.vercel.app` / `emorapy-admin.vercel.app`，並以 `/version.json` 驗證可公開服務；legacy aliases 保留作兼容。
   - Railway：仍待為 backend service 加 Emorapy domain。
   - 驗證新 domain 可服務：`EMORAPY_MAIN_WEB_URL=https://emorapy.vercel.app EMORAPY_ADMIN_WEB_URL=https://emorapy-admin.vercel.app EMORAPY_BACKEND_BASE_URL=<new-backend> npm run ops:release:status`。
2. **設 GitHub repo / environment variables（使用者 + Codex）**：設定 `EMORAPY_MAIN_WEB_URL`、`EMORAPY_ADMIN_WEB_URL`、`EMORAPY_BACKEND_BASE_URL`、`EMORAPY_RAILWAY_SERVICE_NAME`（若 Railway service 改名）、`EMORAPY_GITHUB_REPO`，使 workflow 與 release gate 走 Emorapy 入口。本步只設 variable，不改 secret 值；2026-06-21 Codex 已設 `EMORAPY_GITHUB_REPO=Alex0158/emorapy`；2026-06-22 Codex 已設 `EMORAPY_MAIN_WEB_URL=https://emorapy.vercel.app` 與 `EMORAPY_ADMIN_WEB_URL=https://emorapy-admin.vercel.app`。
3. **GitHub repo rename（使用者或 Codex CLI）**：`Settings → General → Rename` 或 `gh api -X PATCH repos/<owner>/<old-repo> -f name=<new-repo>`。GitHub 自動對舊 slug 建立 redirect；Codex 執行前需先確認 `gh repo view` 顯示 `viewerPermission=ADMIN` 且新 slug 不存在。2026-06-21 Codex 已將 `Alex0158/mother-bear-court` 改名為 `Alex0158/emorapy`，repo id 保持不變。
4. **更新本機 remote（Codex）**：`git remote set-url origin git@github.com:<owner>/<new-repo>.git`，再 `git remote -v` 確認。2026-06-21 Codex 已更新為 `git@github.com:Alex0158/emorapy.git`。
5. **確認平台 integration（使用者 + Codex）**：Vercel / Railway 的 GitHub integration 綁定的是 repo id（rename 後通常自動跟隨）；確認最近一次 push 仍能觸發 Vercel / Railway deploy。
6. **切正式入口（Codex）**：2026-06-22 已把 platform map（`AGENTS.md` Platform Map、`03-管理端與平台治理/05-運維連接與調用Runbook.md`）與 release helper / workflow default 切到 Vercel Emorapy domains，legacy Vercel hostnames 降級為 compatibility aliases。
7. **backend legacy default 降級（後續輪）**：取得正式 backend domain 後，另開一輪把 `EMORAPY_BACKEND_BASE_URL` / Railway service / backend release evidence 切到 Emorapy domain；未取得前不得移除 Railway legacy hostname default。

### 驗證命令

```bash
npm run ops:release:status                     # 確認新入口可解析
EMORAPY_MAIN_WEB_URL=<new> npm run ops:release:status
git remote -v                                  # 確認 origin 指向新 repo
npm run naming:check
npm run docs:check
```

### 完成判定（DoD）

1. Emorapy domain 對 main / admin / backend 可服務，且 `/version`（含 `commitSha`）正確；2026-06-22 main/admin 已達成，backend 仍待。
2. 本機 `origin` 指向新 repo，push 仍觸發 Vercel / Railway deploy。
3. platform map / runbook / AGENTS.md 的 Vercel 正式入口已是 Emorapy domain，legacy Vercel hostname 標為 compat；backend 仍用 Railway legacy hostname until new backend domain evidence exists。
4. `npm run naming:check`、`npm run docs:check` 通過。
5. 在 backend legacy default 尚未移除前，不得宣稱「domain migration 全部完成」，只能宣稱「Vercel 正式入口已切換，legacy 仍作兼容」。

### 2026-06-21 Codex 執行與外部平台現況

1. GitHub repo 已由 `Alex0158/mother-bear-court` rename 為 `Alex0158/emorapy`；repo id 保持 `R_kgDOQm7FhQ`，本地 `origin` 已指向 `git@github.com:Alex0158/emorapy.git`。
2. GitHub repo variable 已設 `EMORAPY_GITHUB_REPO=Alex0158/emorapy`；App release GitHub secret helper 的 default fallback 已改為 `Alex0158/emorapy`，不再默認依賴舊 slug redirect。
3. Vercel CLI 2026-06-21 舊觀測為：project list 仍顯示 main project `mother-bear-court`，production alias 仍是 `https://mother-bear-court.vercel.app`。該觀測已被 2026-06-22 更新 supersede，不再代表當前 Vercel project name / primary project-domain defaults。
   - 2026-06-22 更新：Codex 已透過 Vercel API rename projects 為 `emorapy` / `emorapy-admin`，並新增 project domains `https://emorapy.vercel.app` / `https://emorapy-admin.vercel.app`；兩者 `/version.json` 均公開可用。舊 aliases `https://mother-bear-court.vercel.app` / `https://frontend-admin-sigma-virid.vercel.app` 仍保留兼容。
4. Railway CLI 已驗證登入；production service source repo 已顯示 `Alex0158/emorapy`，但 service name 仍是 `mother-bear-court`，service domain 仍是 `mother-bear-court-production.up.railway.app`，custom domains 為空。當前 Railway CLI `service` 子命令沒有 rename 操作；未取得正式 Emorapy backend domain 前，不得改 workflow/service fallback。
5. `npm run ops:release:status` 在 legacy URL 下仍可執行並回傳 Vercel Ready / Railway SUCCESS 狀態；由於 local branch commit 與 production commit 不同，該命令只證明現有 legacy production entry 仍可用，不代表本輪命名變更已部署到 production。

### 停止 / 回滾條件

- 若 repo rename 後 Vercel / Railway integration 斷開、Actions 無法觸發、或 `/version` 回 `unknown`：把 GitHub variable 指回 legacy、回報實際錯誤、不要邊壞邊改。
- DNS / TLS 未生效前不得切正式入口。

### 禁止事項

- 不得在未加 Emorapy domain alias、未驗證可服務前直接移除 legacy hostname default。
- 不得在本輪移除 `mother-bear-court` legacy default（屬後續降級輪）。

---

## T1-L：本地 workspace / 檔名 / 路徑命名收斂（Codex repo 內受控執行）

### 目標

把本地開發入口與 current docs 的物理路徑口徑從 legacy `mother-bear-court` 收斂到 Emorapy slug；同時保留歷史 evidence、dated ledger、legacy hostname 與外部平台兼容 default，不用全局替換破壞追溯。

### 執行角色

repo 內由 **Codex** 執行；若要改 Finder / IDE workspace 顯示名稱，Codex 可在 commit / push 後用本機 `mv` 完成，並改用新 cwd 繼續驗證。若當前 Codex session、IDE 或正在運行的 dev server 鎖定舊路徑，停止 rename，改為先提交 repo 內準備工作。

### 詳細步驟

1. **盤點本地舊命名**：用 `rg` / `git grep` / `find` 分別盤點 tracked current files、ignored build artifacts、historical docs、generated native cache 與外部平台 default。
2. **分類**：
   - 必改：current docs 對正式 namespace 的錯誤引用、root SSOT 內對當前資料夾的正式路徑說法、repo remote。
   - 暫留：legacy Vercel / Railway hostname default、Railway service fallback、Supabase Dev project name。
   - 歷史保留：`07/已處理/`、`90-證據與盤點/`、`99-歷史降級索引/`、`文件收斂/`、dated `CJ-*` ledger 檔名。
   - generated / ignored：`node_modules`、native `.cxx`、`dist`、`backend/tmp`、`output`、`temp` 不作手工命名治理。
3. **repo 內修正**：current docs 的 `EMO-*` namespace 口徑、T1/T2/T3 交接文件、root README 的 allowed Markdown zone、platform map / runbook 的正式入口說法按實際外部狀態更新。
4. **本地 root folder rename**：只在 repo 乾淨、外部 remote 已確認、沒有必要長跑 process 時，把 workspace 下的 repo folder 從 `mother-bear-court` 改為 `emorapy`；rename 後立即用新 cwd 跑 `git rev-parse --show-toplevel`、`git status --short --branch`、`npm run naming:check`、`npm run docs:check`。
5. **外部平台不同步時的邊界**：本地 folder 可先改；GitHub repo / Vercel / Railway domain 未完成時，文件必須明確標註 legacy hostname / service / project name 仍是 compatibility default，不得宣稱 T1 domain migration 完成。

### 驗證命令

```bash
git rev-parse --show-toplevel
git remote -v
npm run naming:check
npm run docs:check
rg -n "CJ-PRD-\\*|CJ-RTM-\\*|mother-bear-court/docs" docs/核心開發文件 --glob '!docs/核心開發文件/07-待處理問題與治理/待處理/Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md' --glob '!docs/核心開發文件/07-待處理問題與治理/待處理/Emorapy命名收斂剩餘任務Codex交接執行單-2026-06-21.md'
```

### 完成判定（DoD）

1. current docs 不再把上游需求 / RTM wildcard 寫成 `CJ-*`；現行 namespace 是 `EMO-*`，`CJ-*` 僅作歷史 mapping / provenance。
2. 若本地 folder 已改名，repo root folder 為 `emorapy`，且 docs 的 current allowed Markdown zone 同步更新。
3. ignored / generated artifacts 內的舊路徑不作完成 blocker，但不得被回寫成 current SSOT。
4. `npm run naming:check`、`npm run docs:check` 通過。

### 禁止事項

- 不得手工改 `node_modules`、native `.cxx`、`dist`、`backend/tmp` 或歷史 evidence 以追求舊名清零。
- 不得在沒有 Emorapy domain release evidence 前移除 legacy hostname defaults。
- 不得把 local folder rename 當成 GitHub / Vercel / Railway domain migration 完成證據。

---

## T2：legacy governance ID `CJ-*` → `EMO-*` 遷移執行輪（Codex repo 內 gated 執行）

**執行狀態**：已完成（2026-06-21）。證據見 [../../90-證據與盤點/命名治理/Emorapy-governance-id-migration-evidence-2026-06-21.md](../../90-證據與盤點/命名治理/Emorapy-governance-id-migration-evidence-2026-06-21.md)。本段保留原 execution spec 作回溯；整體交接單仍因 T1/T3 未完成而保持活躍。

### 目標

把 current SSOT 文檔中的 `CJ-*` 治理 / 需求 ID 遷移為 `EMO-*`，前綴替換、suffix 與編號保持不變、一一對應、可逆、不丟追溯，並讓 docs gate 接受新前綴、防止舊前綴在 current docs 回流。

### 執行角色

repo 內全程由 **Codex** 執行；不需要外部平台操作。執行前建議由使用者確認「現在啟動 ID 遷移」這一決策（屬產品/治理決策）。

### 前置依賴

1. 權威前綴映射表已固定於 `Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md` 的「P5 legacy governance ID namespace 遷移映射與策略」一節（23 個命名空間，`CJ-<CAT>` → `EMO-<CAT>`）。
2. 範圍：current SSOT 子域、root flagship docs、active governance current references 與對應 gate 腳本；實際執行覆蓋 `00`、`03`、`04`、`05`、`06`、`08`、`20`、`50` 與根層旗艦文檔；**排除** `07/已處理`、`90`、`99`、`文件收斂`（歷史原文不改）。

### 詳細步驟（嚴格依序，不可跳步）

1. **凍結快照（evidence）**：
   ```bash
   git grep -ohE "CJ-[A-Z0-9]+(-[A-Z0-9]+)+" -- docs/核心開發文件 | sort -u > /tmp/cj-id-inventory.txt
   wc -l /tmp/cj-id-inventory.txt   # 預期 ~290
   ```
   把清單存為遷移 fixture / evidence（放 `90-證據與盤點/` 新增 evidence，不覆蓋舊檔）。
2. **gate 先行（過渡期雙接受）**：先改 `scripts/check-docs-structure.mjs` 與 `scripts/check-docs-truth.mjs` 中對 ID 格式 / 引用的 regex 與校驗，使其同時接受 `CJ-*` 與 `EMO-*`；先讓 `npm run docs:check` 在「未改任何 ID」狀態下仍通過，證明 gate 改動本身不破壞現狀。
3. **建立 ID mapping 表（機械可逆）**：由 step 1 清單生成 `CJ-X → EMO-X` 一一對應表，存為治理 evidence；供 step 4 比對與未來回溯。
4. **current docs 批次替換（僅前綴）**：只在 current SSOT / current formal docs 範圍，將 `CJ-`（後接命名空間大寫字母）替換為 `EMO-`。逐域進行、逐域跑 `docs:check:truth`，不要一次全庫替換。排除清單見前置依賴。
5. **雙向引用核對**：替換後 `git grep -ohE "EMO-[A-Z0-9-]+" docs/核心開發文件 | sort -u` 與 step 1/3 的 mapping 比對，確認數量與一一對應；`docs:check:truth` 確認交叉引用無斷鏈。
6. **naming / structure gate 收尾**：把 `EMO-*` 設為現行；在 current docs 把 `CJ-*` 標為禁止回流（歷史層仍允許）；更新 `術語表.md` 與 `00-跨端產品核心/01-產品PRD總章.md` 的 namespace policy（現行為 `EMO-*`，`CJ-*` 為歷史 ID）。同步調整 `check-emorapy-naming-governance.mjs` 的 `checkLegacyGovernanceIdNamespacePolicy`（目前要求保留「不得改 CJ-* ID」字句——遷移完成後應改為「現行 EMO-*，CJ-* 為歷史」）。
7. **回寫待辦**：在 `Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md` 記錄執行結果與 DoD，把 P5 PRD ID migration 從「待 gated 執行」改為已完成。

### 驗證命令

```bash
npm run docs:check                  # structure + truth + naming
npm run docs:audit:dry-run:current
git grep -c "CJ-" docs/核心開發文件/00-跨端產品核心 docs/核心開發文件/04-共用機制 docs/核心開發文件/05-工程架構與共享層 docs/核心開發文件/06-接口描述 docs/核心開發文件/20-App端 docs/核心開發文件/50-跨端Mapping與Parity
# 上行在 current 子域應趨近 0（僅剩明確標為歷史引用者）
```

### 完成判定（DoD）

1. current SSOT 子域、current formal docs、active governance current references + 根層旗艦文檔的 `CJ-*` ID 已全部變為 `EMO-*`，且與 step 1 清單一一對應、數量相等。
2. `07/已處理`、`90`、`99`、`文件收斂` 歷史原文未被改寫。
3. docs structure / truth / naming gate 全部通過；交叉引用無斷鏈。
4. 術語表與 PRD 主章的 namespace policy 已更新為「現行 `EMO-*`，`CJ-*` 為歷史」。
5. 遷移 fixture / mapping evidence 已留存。

### 停止 / 回滾條件

- 若 step 4 後 `docs:check:truth` 報引用斷鏈且數量與 mapping 不符：停下、`git checkout` 回滾該域、重新逐檔核對，不要強推。
- 若發現某 ID 在歷史層與 current 層被同一引用串連（跨 P6 邊界）：先在待辦記錄該耦合點再處理，不可直接改歷史檔。

### 禁止事項

- 不得全庫 `sed` 替換（會污染 env / host / package / 歷史證據中的 `CJ`）。
- 不得跳過 step 2 的 gate-先行（否則 step 4 會立即打爆 truth gate）。
- 不得改寫歷史層 ID 原文。

---

## T3：App release 命名相關外部憑證與證據（使用者外部 + 既有待辦承接）

### 目標

完成 Apple Developer / App Store Connect / Sentry 外部建檔，並以 Emorapy identity 重新產出 release evidence，使 App strict release sign-off 不再被 legacy identity 或缺失外部資源阻塞。

### 執行角色

外部帳號操作：**使用者**。evidence 重跑、audit、文檔收尾：**Mobile / Codex**。

### 與既有待辦的關係（不重複，只交叉引用）

本任務的完整 spec 已存在於 `App外部ReleaseSignoff待辦-2026-05-16.md` 與 `App跨端Parity落地待辦-2026-05-05.md`。本執行單只標註「命名收斂視角」的依賴：這些外部資源與 evidence 必須使用 Emorapy identity（`com.emorapy.app`、`emorapy-mobile`、`@alexdev518/emorapy-mobile`、Sentry project `emorapy-mobile`），不得回退 legacy `cj-mobile` / `com.cj.motherbearcourt`。

### 詳細步驟（命名相關關鍵項；完整步驟見既有待辦）

1. **Apple Developer（使用者）**：註冊 explicit App ID `com.emorapy.app`，啟用 Push Notifications。
2. **App Store Connect（使用者）**：以 `Emorapy` / `English (U.S.)` / `com.emorapy.app` / SKU `emorapy-ios-app` 建 app record；不得提交任何 `CJ` record。
3. **Sentry（使用者）**：建立 project `emorapy-mobile`，把 `APP_SENTRY_ORG`、`APP_SENTRY_PROJECT=emorapy-mobile`、`APP_SENTRY_AUTH_TOKEN` 放入 ignored release env / CI secret。
4. **evidence 重跑（Codex / Mobile）**：以 Emorapy identity 重跑 EAS iOS / TestFlight、physical device、push provider delivery、native crash runtime evidence；舊 `com.cj.motherbearcourt` evidence 由 audit 視為 stale，不改寫。
5. **audit 收尾（Codex）**：`release:completion:audit` 與 `goal:completion:audit` 重跑，更新既有待辦的證據狀態。

### 驗證命令

```bash
npm --prefix mobile run release:completion:audit -- --release-env-file=release.env.local --json
npm --prefix mobile run goal:completion:audit -- --release-env-file=release.env.local --json
npm --prefix mobile run release:completion:audit:strict -- --json
```

### 完成判定（DoD）

1. Apple Developer App ID、App Store Connect record、Sentry project 均以 Emorapy identity 建立。
2. EAS iOS / TestFlight / 真機 / push provider / native crash runtime evidence 以 Emorapy identity 產出並通過 audit。
3. `release:completion:audit` 由 incomplete 轉為 complete（或明確記錄剩餘外部 blocker）。
4. 既有 `App外部ReleaseSignoff待辦-2026-05-16.md` 的證據狀態同步更新。

### 停止 / 回滾條件

- 若 App Store Connect / Apple Developer 頁面提示 name / bundle id / SKU 已被佔用或 agreement 未簽：停下、記錄實際頁面訊息、不得改用舊名繞過。

### 禁止事項

- 不得提交 Apple / ASC / EAS / Sentry / push provider secret 到 repo；只記 key name / presence / owner action。
- 不得把舊 `cj-mobile` / `com.cj.motherbearcourt` evidence 改寫成新 evidence。

---

## 總體完成判定

當 T1 / T2 / T3 各自的 DoD 都滿足，且 `Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md` 的「驗收口徑」全部成立時，Emorapy 命名收斂可整體閉環。在此之前，本執行單保持活躍，任一任務完成後在對應任務段標註完成日期與證據連結，但不得把本執行單整體狀態改為「已處理/已閉環/已完成」直到三者全部達成。

2026-06-21 更新：T2 已完成；T1 GitHub repo / Vercel / Railway domain rename 與 T3 App release 外部憑證 / evidence 仍未完成，因此本執行單整體保持活躍。
