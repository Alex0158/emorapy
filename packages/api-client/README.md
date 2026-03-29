# API Client Core

這個 package 放「純資料層 transport core」，目的是把目前 Web 端 `request.ts` 中可抽離的底層能力，逐步拆成可跨平台共用的基礎層。

這一層可以放：

- axios/fetch client factory
- request defaults
- 通用 request context 型別
- 與 UI 無關的重試、序列化、解析工具

這一層不應放：

- Ant Design `message`
- `window.location`
- `localStorage` / `sessionStorage`
- `SecureStore`
- React Router / Expo Router

Web 與 Mobile 需各自保留 adapter，處理平台專屬的 token、session、導轉與錯誤提示。
