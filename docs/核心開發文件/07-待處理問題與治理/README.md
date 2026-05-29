# 待處理問題與治理

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：07-待處理問題與治理 子域入口與閱讀順序
**取證代碼入口**：`backend/src`、`frontend/src`、`frontend-admin/src`、`docs/核心開發文件`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` 的活躍問題、優先級與治理狀態，但根層只保留活躍入口與已處理台帳入口。

它回答的是：

1. 目前還有哪些未完成收口的產品、技術或治理問題
2. 哪些問題仍值得優先處理
3. 問題應回到哪份正式規格、接口文檔或證據入口

它不回答：

1. 現行產品規格正文是什麼
2. 某輪歷史排查是怎樣展開的
3. 已退出活躍範圍的歷史報告如何回看

上述三類內容應分別回到：

1. `核心開發文件/` 正式正文
2. `文件收斂/`
3. `99-歷史降級索引/`

## 結構分層

根層目前只保留以下活躍入口文件：

1. `README.md`
2. `00-活躍問題總覽.md`

狀態子目錄固定如下：

1. `待處理/`
2. `已處理/`
3. `不處理/`

當前治理口徑：

1. 活躍區只保留仍未收口的發版風險、證據風險與需持續追蹤的治理項。
2. 已確認完成回寫的代碼級缺陷台帳，必須移入 `已處理/`，不得繼續掛在 `待處理/`。
3. `不處理/` 只承接已做決策、且本輪不再升級為活躍治理項的事項。
4. `npm run docs:check` 會拒絕 `待處理/` 內 `**狀態**` 已是 `已處理`、`已閉環` 或 `已完成` 的文件；若任務完成，先回寫正式正文與結果，再移入 `已處理/`。

## 使用順序

1. 先看 [00-活躍問題總覽.md](./00-活躍問題總覽.md)
2. 若已有專題文件，再進對應狀態子目錄
3. 再回到根層旗艦文檔與 `06-接口描述/` 核對正式口徑
4. 最後再看實際代碼與補充證據

## 自動生成待辦口徑

以下差異不得只停留在口頭或單份正文中；若尚未雙邊閉環，必須新增或更新 `待處理/` 任務：

1. dev / release、docs / code、schema / runtime、Web / App 任一側存在必須統一的差異。
2. API、DB schema、shared contracts、api-client、auth/session、Deep Link、notification、upload、telemetry 變更會影響 App parity。
3. `mobile/app` 從模板 navigation 推進到 CJ App screen，或 `mobile/src/platform` 從 types-only 推進到 runtime adapter。

App 相關待辦必須同時反引 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)，避免只記錄「App 未完成」而沒有工程落點。
