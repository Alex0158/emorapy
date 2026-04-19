# 樣式 Token 與共享視覺規範

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：前後台共享元件、樣式 token 與流式通用機制：01-樣式Token與共享視覺規範
**取證代碼入口**：`frontend/src/App.tsx`、`frontend-admin/src/App.tsx`、`frontend/src/components/common`、`frontend/src/services/request.ts`、`frontend/src/services/sseRequest.ts`、`frontend/src/services/aiStream.ts`、`frontend-admin/src/services/request.ts`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`963c0d3`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文件承接 theme token、樣式變量與視覺收斂規則，避免頁面層繼續分散硬編碼。

當前現碼的正式真相是：

1. 主 Web 的 Ant Design theme token 直接定義在 `frontend/src/App.tsx`
2. Admin Web 的 Ant Design theme token 直接定義在 `frontend-admin/src/App.tsx`
3. 目前不存在 `frontend/src/styles/theme.ts`、全域 `AppThemeProvider.tsx` 或單一跨 Web/Admin 的 token 中樞

## 1. Token 責任邊界

### 1.1 App Theme Token

用於控制元件基礎樣式：

1. 主色與語義色
2. 圓角、字體、尺寸等元件預設
3. 由各自 App 入口的 `ConfigProvider theme={...}` 注入

### 1.2 樣式變量

用於頁面級與業務元件視覺樣式：

1. 品牌色
2. 字體
3. 間距
4. 圓角
5. 陰影

目前這一層仍以各端 `App.less` 與組件樣式為主，不存在單一 repo 級樣式變量中心。

### 1.3 Utility / Layout 樣式

只承接 layout 與少量 utility，不直接承擔品牌色細節。

## 2. 禁止清單

1. 非特殊場景，禁止在 JSX 新增第三套 page-level hex / rgb / rgba 色碼來源
2. 非極少數例外，不用 inline `style` 承擔陰影、圓角、背景等長期視覺真相
3. 不得把主 Web 與 Admin 都會依賴的 token 再分散到多個頁面檔內各自命名
4. 同一層 layout 不同時用 utility 與業務樣式重複控制同一視覺責任

## 3. 收斂原則

1. 新增或重構頁面時，先判斷應修改 `frontend/src/App.tsx` 或 `frontend-admin/src/App.tsx` 的 theme token，還是只屬於局部樣式
2. 主 Web 與 Admin 若要共享同一批 token，應先抽成可追蹤常量，再使用，不能直接複製兩份後各自漂移
3. utility 僅用於 layout 與少量結構性樣式
4. code review 需檢查是否把視覺真相重新分散到頁面層，或把不存在的“全域共享樣式中心”當成既有現狀

## 4. 關聯正文

1. 跨流共用規則：見 [00-共用機制總覽.md](./00-共用機制總覽.md)
2. 工程分層與共享包：見 [../05-工程架構與共享層/README.md](../05-工程架構與共享層/README.md)
