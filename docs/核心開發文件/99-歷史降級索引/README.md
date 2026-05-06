# 歷史降級索引

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：歷史索引
**來源時間**：2026-04-18
**上下文**：非現行 SSOT；僅保留歷史方案與遷移索引
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄是 `核心開發文件/` 的歷史回看入口，不是正式正文層。

本目錄內的文件只保留“為何曾這樣設計”與“現在去哪裡找現行入口”兩種價值，不再直接承接任何現行開發裁決。

只回答三件事：

1. 哪一批材料已退出正式依據層
2. 應從哪個降級索引回看
3. 原始材料現在落在哪裡

當前入口：

1. [00-2026-04-首輪重構遷移索引.md](./00-2026-04-首輪重構遷移索引.md)
2. [APP版本開發方案-ReactNative-Expo.md](./APP版本開發方案-ReactNative-Expo.md)

使用規則：

1. 開發、修改、排查，先看 `核心開發文件/README.md`。
2. 只有在現行正文、測試入口與證據入口無法回答「歷史上曾怎樣處理」時，才進本目錄。
3. 若歷史方案中仍有穩定決策，應回寫到正式子域，而不是直接把歷史稿重新升格。
4. App 版現行入口是 `20-App端/` 與 `50-跨端Mapping與Parity/`；`APP版本開發方案-ReactNative-Expo.md` 只保留歷史方案回看價值。
5. 歷史方案中的命令、包版本、目錄建議、發布工具與成本估算不得直接作為現行操作指令；若需要採用其中任一點，必須先回寫到現行 App / Parity / 工程架構文件。

## App 歷史方案替代入口

若是要開發或評估 App，不從本目錄開始，固定從以下入口開始：

1. [../00-跨端產品核心/README.md](../00-跨端產品核心/README.md)：確認產品能力、角色、流程與狀態語義。
2. [../20-App端/README.md](../20-App端/README.md)：確認 App 端現況與平台投影。
3. [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)：確認 Expo Router、SecureStore、Push、Deep Link、upload、telemetry 等 App gate。
4. [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)：確認 App screen 對 Web / Backend / API / DB / shared package 的工程落點。
5. [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md)：確認未閉環任務。
