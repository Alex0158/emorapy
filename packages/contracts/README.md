# Contracts

這個 package 作為跨平台共享契約的單一來源。

目前先收斂的領域：

- `auth`
- `case`
- `chat`
- `common`
- `interview`
- `session`

設計目標：

- 避免 frontend / backend / mobile 各自維護重複型別
- 讓 Web 與 App 共享同一份 DTO 與 enum
- 逐步成為後續 API schema 與 client code generation 的基礎
