# Shared Packages

這個目錄存放可跨 Web、Mobile、Backend 共用的代碼。

目前的切分原則：

- `contracts/`：DTO、enum、response shape、SSE 事件、共享型別
- `api-client/`：純 transport core，不直接依賴 UI、router 或平台 storage

設計準則：

- 優先放「純資料」與「純邏輯」
- 不放 React 元件
- 不放 `window`、`document`、`localStorage`、`SecureStore`
- 不放 Ant Design、Expo Router、React Router 等平台框架耦合
