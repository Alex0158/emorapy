# APP 版本開發方案：React Native + Expo

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：歷史方案
**來源時間**：2026-04-18
**上下文**：非現行 SSOT；僅保留歷史方案與遷移索引
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0
**建立日期**：2026-03-15
**適用專案**：CJ 平台 / Emorapy

---

> 本文件是 `2026-03-15` 的移動端歷史方案快照，只能用來回看當時為何選擇 React Native + Expo。現行 App 開發不得直接採用本文的快速啟動指令、目錄建議、包版本、工具成本估算或 implementation contract。
>
> 現行入口固定為 [../20-App端/README.md](../20-App端/README.md)、[../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)、[../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 與 [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md)。

---

## 現行替代口徑

本文中的穩定結論只剩一項：App 技術方向曾選擇 React Native + Expo。其餘落地細節一律以現碼與現行核心文件為準。

1. `mobile/` 已存在，不能再按本文 `npx create-expo-app ... cj-mobile` 新建第二套 App。
2. `mobile/app` 當前仍是 Expo Router 模板骨架，不能視為 CJ 產品 navigation 已完成。
3. `mobile/src/platform` 目前只具備 storage / notifications / upload 的 types-only 邊界，不能視為 SecureStore、Push 或 upload runtime adapter 已完成。
4. App 需要新增 API、DB 欄位、shared enum、Deep Link、Push token 或 upload 授權時，必須先更新 `20-App端/01-App導航與平台Adapter基線.md` 與 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`，必要時新增待辦。
5. 本文後續段落若與上述入口或現碼衝突，一律以現碼與現行核心文件為準。

## 一、方案概述

本文件為 CJ 平台開發 Android 與 iOS APP 的技術方案報告，建議採用 **React Native + Expo** 作為跨平台開發工具，以最大化與現有 Web 前端（React 19 + TypeScript）的程式碼共用，並在開發成本與原生體驗之間取得平衡。

---

## 二、專案現況與技術對齊

| 維度 | 現況 |
|------|------|
| **前端** | React 19 + TypeScript + Vite + Ant Design + Zustand + React Query |
| **後端** | REST API（Express + Prisma），無需改動 |
| **即時通訊** | SSE（`/chat/rooms/:id/stream`）用於聊天室即時訊息 |
| **其他** | 訪談 SSE、檔案上傳、JWT 認證、Framer Motion 動畫 |

---

## 三、工具清單

### 3.1 核心工具

| 工具 | 用途 | 費用 |
|------|------|------|
| **Node.js** (≥20) | 執行環境 | 免費 |
| **React Native** | 跨平台 App 框架 | 免費 |
| **Expo SDK** (52+) | 開發與建置工具 | 免費 |
| **TypeScript** | 型別與程式碼品質 | 免費 |

### 3.2 開發環境

| 工具 | 用途 | 費用 |
|------|------|------|
| **VS Code** | 編輯器 | 免費 |
| **Expo CLI** | 專案建立與指令 | 免費 |
| **iOS Simulator** | iOS 預覽（需 macOS + Xcode） | 免費 |
| **Android Emulator** | Android 預覽（需 Android Studio） | 免費 |
| **Expo Go** | 實機即時預覽（掃 QR code） | 免費 |

### 3.3 UI 與導覽

| 工具 | 用途 | 費用 |
|------|------|------|
| **React Navigation** | 頁面導覽 | 免費 |
| **React Native Paper** 或 **Tamagui** | UI 元件庫 | 免費 |
| **NativeWind**（可選） | Tailwind 風格樣式 | 免費 |

### 3.4 共用與 API

| 工具 | 用途 | 費用 |
|------|------|------|
| **Zustand** | 狀態管理（沿用） | 免費 |
| **TanStack Query** | 資料取得與快取（沿用） | 免費 |
| **Axios** 或 **fetch** | API 請求（沿用） | 免費 |
| **@microsoft/fetch-event-source** 或 **react-native-sse** | SSE 即時串流 | 免費 |

### 3.5 原生能力

| 工具 | 用途 | 費用 |
|------|------|------|
| **expo-image-picker** | 相機／相簿 | 免費 |
| **expo-secure-store** | 安全儲存（JWT 等） | 免費 |
| **expo-notifications** | 推送通知 | 免費（EAS Free 有額度） |

### 3.6 建置與發布（可選）

| 工具 | 用途 | 費用 |
|------|------|------|
| **EAS Build** | 雲端建置 iOS / Android | Free：約 30 次/月 |
| **EAS Submit** | 提交到 App Store / Play | 含在 EAS 方案 |
| **EAS Update** | OTA 更新 | 含在 EAS 方案 |

### 3.7 上架商店

| 平台 | 費用 |
|------|------|
| **Apple Developer** | $99 USD / 年 |
| **Google Play Console** | $25 USD 一次性 |

---

## 四、介面預覽能力

React Native + Expo 可像 Flutter 一樣在模擬器與實機上預覽 App 介面：

| 項目 | Flutter | React Native + Expo |
|------|---------|---------------------|
| iOS 模擬器 | ✅ | ✅（需 macOS） |
| Android 模擬器 | ✅ | ✅ |
| 實機預覽 | ✅（通常需接線） | ✅（Expo Go 掃 QR 即可） |
| 即時更新 | ✅ Hot Reload | ✅ Fast Refresh |
| 介面預覽 | ✅ | ✅ |

---

## 五、費用總覽

| 階段 | 費用 |
|------|------|
| 開發與測試 | **$0** |
| 上架 iOS | **$99/年** |
| 上架 Android | **$25 一次性** |
| EAS 進階方案（可選） | **$29/月起** |

---

## 六、快速啟動指令

```bash
# 1. 建立 Expo 專案
npx create-expo-app@latest cj-mobile --template tabs

# 2. 進入專案並安裝常用套件
cd cj-mobile
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-paper react-native-safe-area-context
npx expo install zustand @tanstack/react-query axios
npx expo install expo-image-picker expo-secure-store expo-notifications

# 3. 啟動開發
npx expo start
```

### 6.1 已安裝狀態（2026-03-17）

專案已建立於 `mother-bear-court/mobile/`，並完成以下安裝：

| 類別 | 套件 | 來源 |
|------|------|------|
| 導覽 | @react-navigation/native, native-stack | npm 官方 |
| UI | react-native-paper | npm 官方 |
| 狀態／API | zustand, @tanstack/react-query, axios | npm 官方 |
| 原生能力 | expo-image-picker, expo-secure-store, expo-notifications | Expo 官方 |
| SSE | @microsoft/fetch-event-source | npm 官方 |
| 全域工具 | eas-cli | npm 官方 |

**驗證**：`npm run web` 可正常啟動。需自行安裝：Xcode（macOS）、Android Studio、Expo Go（手機）。

---

## 七、專案結構建議

建議採用 monorepo 結構，將共用邏輯抽離：

```
mother-bear-court/
├── packages/
│   ├── shared/          # 共用：API client、型別、業務邏輯
│   ├── web/             # 現有 frontend（Vite）
│   └── mobile/          # 新建：Expo app
```

**可共用層：**
- API 請求（axios / fetch）
- 型別定義
- Zustand store（與平台無關部分）
- 業務邏輯（判決、案件、聊天等）

**需重寫／替換：**
- UI：Ant Design → React Native Paper / Tamagui
- 路由：React Router → React Navigation
- SSE：使用 `@microsoft/fetch-event-source` 或 `react-native-sse` polyfill

---

## 八、技術注意事項

### 8.1 SSE 即時串流

- **聊天室**：`GET /chat/rooms/:id/stream`
- **訪談**：`respond` / `skip` 的 token 串流

React Native 可使用 `fetch` + `ReadableStream`（RN 0.72+）或 `@microsoft/fetch-event-source`、`react-native-sse` 等套件。

### 8.2 檔案上傳

- **React Native**：`expo-image-picker`、`expo-document-picker`
- 證據上傳、執行追蹤打卡照片等流程需對接原生選擇器。

### 8.3 認證與儲存

- JWT：使用 `expo-secure-store` 取代 `localStorage`
- Session：可沿用既有 session 機制，需適配儲存方式。

---

## 九、替代方案簡述

| 方案 | 程式碼共用 | 開發成本 | 適用情境 |
|------|------------|----------|----------|
| **Capacitor** | 95%+ | 低 | 快速 MVP、預算緊 |
| **React Native + Expo** | 60–70% | 中 | 長期產品、重視體驗（**本方案**） |
| **Flutter** | 僅 API | 高 | 團隊已有 Flutter 經驗 |
| **原生（Kotlin + Swift）** | 僅 API | 最高 | 資源充足、追求極致體驗 |

---

## 十、參考連結

- [Expo 官方文檔](https://docs.expo.dev/)
- [React Native 官方文檔](https://reactnative.dev/)
- [EAS 定價](https://expo.dev/pricing)

---

**文檔維護**：本文已降級為只讀歷史快照，不再隨專案演進更新為現行方案。若其中內容需要重新成為正式規則，必須先回寫到 `20-App端/`、`50-跨端Mapping與Parity/` 或對應正式子域。
