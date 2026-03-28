# CJ 核心開發文件（SSOT）

**文檔版本**：v1.7  
**最後更新**：2026-03-28  
**對應發佈**：v1.3.2（回歸門禁與發版治理增補）  
**定位**：本目錄為 CJ 項目一級核心開發文檔（SSOT）。

---

## 主文檔

- `功能特性清單.md`
- `頁面清單.md`
- `全接口清單-主文檔.md`
- `接口-功能-頁面-Mapping.md`
- `業務流程整合.md`
- `術語表.md`

## 子文檔

- `接口描述/`（按模組拆分）
- `test-cases/quick-experience/`（快速體驗測試案例，含 5 份雙方口供與預期判決）
- `Marketing/`（產品定位、短影音付費推廣、合規文案、**Gemini／即夢手動分鏡工作流**、**campaigns/ 單案 MD**；見 [Marketing/README.md](./Marketing/README.md)）

## 擴展規劃

- `APP版本開發方案-ReactNative-Expo.md`（Android / iOS APP 開發工具與方案）

## 治理

- `維護規範.md`
- `文檔封板後-代碼與測試對齊清單.md`
- `業務缺陷收斂台帳-2026-03-17.md`
- `發版前回歸記錄-2026-03-17.md`
- `發版前手動回歸包-2026-03-17.md`
- `發版前手動回歸執行版-2026-03-17.md`
- `發版前手動回歸證據/2026-03-17/`
- `已知風險清單-2026-03-17.md`
- `不納入發版項清單-2026-03-17.md`
- `P01-claim-session真服務預檢記錄-2026-03-17.md`
- `F02-真DB驗證記錄-2026-03-17.md`
- `高風險API抽檢記錄-2026-03-17.md`
- `文檔封板後-對齊執行記錄-2026-03-09.md`
- `審計記錄-2026-03-06.md`（文檔代碼對齊審計）
- `scripts/check-critical-e2e-skips.mjs`（關鍵 e2e `.skip` 防回退檢查）
- `scripts/init-manual-regression-batch.mjs`（手動回歸批次初始化）
- `scripts/check-manual-regression-status.mjs`（手動回歸回填完整性與證據檢查）
- `scripts/summarize-manual-regression.mjs`（手動回歸結果總覽生成）
- `scripts/mark-manual-regression-result.mjs`（手動回歸單流程命令式回填）
- `scripts/run-manual-regression-gate.mjs`（手動回歸 gate 串行入口）
- `scripts/smoke-staging.sh`（staging smoke gate，本地入口）
- `.github/workflows/manual-regression-gate.yml`（手動回歸 gate，支持按日期執行 strict 檢查）

## 閱讀順序（建議）

1. `功能特性清單.md`（先看主功能分層、邊界與附錄能力）
2. `頁面清單.md`（看入口與守衛）
3. `全接口清單-主文檔.md`（看接口全貌與狀態）
4. `接口-功能-頁面-Mapping.md`（做回歸追溯）
5. `業務流程整合.md`（看跨角色流程）
6. `術語表.md`（統一語義）
