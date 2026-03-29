# Mobile Features

這個目錄用來放 App 業務功能模組，例如：

- `auth/`
- `case/`
- `chat/`
- `profile/`

原則：

- 預設以 iOS/Android 共用為前提
- 功能頁、容器、feature hooks 優先放在這裡
- 只有平台差異明顯時，才在元件層拆 `*.ios.tsx` 或 `*.android.tsx`
