# App 跨端 Parity 落地待辦（2026-05-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App 版承接跨端產品核心、共享 contracts / api-client、原生能力與 Web 基線 Parity 的待處理任務
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/(tabs)/_layout.tsx`、`packages/contracts/src`、`packages/api-client/src`、`frontend/src/router/index.tsx`、`backend/src/routes`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：待處理
**Owner**：Mobile / Frontend / Backend
**關聯核心文件**：`20-App端/00-App端總覽.md`、`50-跨端Mapping與Parity/00-跨端Parity總覽.md`

---

## 1. 背景

核心文件已把 Web 版與 App 版調整為同一產品核心的不同平台投影。當前 `mobile/` 已存在 Expo 專案骨架，並在 `mobile/tsconfig.json` 預留 `@cj/contracts` 與 `@cj/api-client` alias，但尚未正式承接 CJ 主產品能力，也尚未消費共享 contracts / api-client。

這不是文檔問題，而是 App 版正式開發前需要閉環的代碼與工程問題。

## 2. 待處理範圍

1. 建立 App API adapter，正式消費 `@cj/contracts` 與 `@cj/api-client`。
2. 裁決 App 首輪能力矩陣：快速判斷、正式處理、先聊再判、心理訪談 / 個人檔案、通知。
3. 建立 App route / navigation 與 Web 凍結基線的能力映射，不直接照搬 browser route guard。
4. 定義 SecureStore token、session restore、refresh、logout 清理策略。
5. 定義 Push token 註冊、失效、取消、notification read 狀態同步與 backend API 影響。
6. 定義 Deep Link 進入 case / chat / judgment / repair journey 的授權失敗回退。
7. 補齊 App smoke / regression / CI 檢查入口。

## 3. 驗收口徑

1. `20-App端/00-App端總覽.md` 不再只描述 Expo 模板骨架，而能對應到 CJ App 首輪路由與能力。
2. `50-跨端Mapping與Parity/00-跨端Parity總覽.md` 中 App 狀態可從「待承接」轉為具體落地狀態。
3. App 對 API / DB / Push / Deep Link 的新增需求都有對應 backend 或 schema 待辦，不再只停留在平台想法。
4. App 不手寫分叉 DTO；共享 enum / response shape 以 `packages/contracts` 為準。
5. App 測試與 smoke gate 進入 `08-測試規範與驗收/` 或 `測試/` 的正式入口。

## 4. 風險

1. 若 App 直接複製 Web 頁面或 DTO，會形成第二套產品語義。
2. 若 Push / Deep Link / SecureStore 不先定義，容易在 auth/session、notification、case visibility 上產生跨端不一致。
3. 若 shared contracts 只停留在 alias 預留，App 後續會難以保持 API 與狀態枚舉一致。

