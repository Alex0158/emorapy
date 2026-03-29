# Mobile Platform Adapters

這個目錄專門放 App 的平台能力 adapter。

建議切分：

- `storage/`：token、session、偏好設定
- `notifications/`：推播註冊與權限
- `upload/`：相機、相簿、檔案選擇

原則：

- 優先把平台差異收斂到這裡
- 業務流程不要直接依賴 Expo API
- 若 iOS / Android 行為不同，再拆成 `*.ios.ts`、`*.android.ts`
