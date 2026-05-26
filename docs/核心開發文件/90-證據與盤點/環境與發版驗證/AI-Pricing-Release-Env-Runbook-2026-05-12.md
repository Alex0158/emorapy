# AI Pricing / Admin Costs Release Env Runbook（2026-05-12）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據產製 Runbook
**來源時間**：2026-05-12
**上下文**：AI request ledger、Admin costs、release pricing env、release DB parity evidence
**SSOT 屬性**：非現行 SSOT（僅作運維產證流程與外部發布前驗證指引）
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本 runbook 用於產出可被 `AI 請求 Ledger 與 Notification 狀態 Schema 同步待辦` 接受的正式 release env / DB parity 證據。它不替代實際價格審批，也不替代 production / release DB 的真實連線結果。

## 1. 前置條件

1. 準備 release / production backend 的顯式環境來源：
   - `ENV_FILE`，或
   - 平台 release env。
2. 準備 `DATABASE_URL`，且必須是非本機 PostgreSQL。
3. 準備 `AI_COST_PRICING_JSON`，格式必須包含：
   - `source`
   - `version`
   - `models`
4. `version` 必須以 `YYYY-MM-DD` 開頭，不能是未來日期，也不能超過 `AI_COST_PRICING_MAX_AGE_DAYS`。
5. `models` 必須覆蓋：
   - `OPENAI_MODEL`
   - `OPENAI_INTERVIEW_MODEL`
   - `OPENAI_ANALYSIS_MODEL`
   - 以及 `AI_COST_REQUIRED_MODELS` 如有設定的額外模型。
6. 價格數值必須先完成業務審批；repo 內不保存真實價格，也不保存 secret。

## 2. 必跑命令

### 2.1 pricing gate

```bash
npm --prefix backend run ops:ai-pricing:check
```

strict pass 的最低條件：

1. `ok=true`
2. `source` / `version` 存在
3. `versionDate` 解析成功
4. `versionAgeDays` 合法且不超過 max age
5. `missingModels=[]`

### 2.2 release DB dry-run / evidence

```bash
npm --prefix backend run ops:release-db:dry-run
```

dry-run 只證明 gate 需要檢查的 release-blocking migrations，不能替代 release evidence。

正式 release DB evidence 必須使用：

```bash
DATABASE_URL=<release-or-production-postgresql-url> npm --prefix backend run ops:release-db:evidence
```

## 3. artifact 形狀

正式 pass artifact 可先複製 [./AI-Pricing-Release-Env-Pass-Template.json](./AI-Pricing-Release-Env-Pass-Template.json)，另存為 `AI-Pricing-Release-Env-<target>-<timestamp>.json`。Template 只固定欄位形狀，不是 pass evidence。

### 3.1 pricing blocker

若缺 `AI_COST_PRICING_JSON` 或 release env 未就緒，允許產出 blocker artifact：

```text
docs/核心開發文件/90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Blocked-*.json
```

這類 artifact 只能記錄：

1. failed command
2. required models
3. missing models
4. release / production DB parity 尚未完成
5. non-claims

不得記錄真實價格數值，也不得聲稱 release pass。

### 3.2 release pass

若 pricing gate 與 release DB evidence 都通過，可產出正式 release evidence artifact。正式 pass artifact 必須至少包含：

1. root `status=passed`。
2. `target.classification=release` 或 `production`。
3. `target.non_local_postgresql=true`，但不得保存 raw `DATABASE_URL`。
4. `pricing_gate.status=passed`，並記錄 `source/version/version_age_days/max_age_days/required_models/missing_models/configured_model_count`。
5. `release_db_evidence.status=passed`，並引用 structured non-local DB parity artifact path。
6. `business_approval.status=approved`，只記 owner role、approval time 與 pricing version，不記 raw price。
7. `non_claims` 至少包含：`no_raw_price_values_in_repo`、`no_secret_or_database_url_in_artifact`、`no_local_env_as_release_env_claim`、`no_dry_run_as_release_db_pass`、`no_admin_cost_precision_claim_without_pricing_gate_and_db_evidence`。

## 4. 不得宣稱

1. `ops:ai-pricing:check` failed 時，不得宣稱 Admin costs 已精準成本閉環。
2. `ops:release-db:dry-run` passed 不等於 release DB passed。
3. 沒有 non-local `DATABASE_URL` 的 evidence，不得宣稱 release DB parity。
4. 本地 `.env` 不得被當作 release env 來源。
5. 沒有審批的價格數值，不得寫進 repo 或 artifact pass claim。

## 5. 關聯文件

1. [../../07-待處理問題與治理/已處理/AI請求Ledger與Notification狀態Schema同步待辦-2026-05-04.md](../../07-待處理問題與治理/已處理/AI請求Ledger與Notification狀態Schema同步待辦-2026-05-04.md)
2. [./README.md](./README.md)
3. [./AI-Pricing-Release-Env-Pass-Template.json](./AI-Pricing-Release-Env-Pass-Template.json)
4. [../../03-管理端與平台治理/01-環境與部署基線.md](../../03-管理端與平台治理/01-環境與部署基線.md)
5. [../../03-管理端與平台治理/05-運維連接與調用Runbook.md](../../03-管理端與平台治理/05-運維連接與調用Runbook.md)
