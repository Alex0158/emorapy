# App Native Crash SDK 配置驗證記錄

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-05-08
**上下文**：App M6 observability baseline、native crash SDK configuration、Sentry React Native
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-08`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0
**最後更新**：2026-05-08
**對應範圍**：`mobile/src/platform/telemetry/nativeCrash.ts`、`mobile/src/platform/telemetry/nativeCrash.test.js`、`mobile/src/platform/telemetry/observability.ts`、`mobile/src/config/runtime.ts`、`mobile/app.json`、`mobile/metro.config.js`、`mobile/package.json`

---

## 本次確認到的狀態

App 已建立 native crash SDK configuration first pass：

- `mobile` 已新增 `@sentry/react-native@~7.11.0` 作為 native crash SDK dependency，並以 Expo SDK 55 expected dependency set 保持 native build compatibility。
- `mobile/metro.config.js` 已改用 `@sentry/react-native/metro` 的 `getSentryExpoConfig`，並保留 monorepo shared package resolution。
- `mobile/app.json` 已新增 `@sentry/react-native/expo` config plugin，未提交 org / project / auth token；後續 EAS/CI 需用 `SENTRY_ORG`、`SENTRY_PROJECT`、`SENTRY_AUTH_TOKEN`。
- 2026-06-20 已用 `SENTRY_DISABLE_AUTO_UPLOAD=true npx expo prebuild --platform ios --clean --no-install` 重新生成 gitignored iOS native output，`mobile/ios/Emorapy.xcodeproj/project.pbxproj` 已包含 `PRODUCT_BUNDLE_IDENTIFIER=com.emorapy.app`、`sentry-xcode.sh` bundle phase 與 `Upload Debug Symbols to Sentry` / `sentry-xcode-debug-files.sh` dSYM upload phase；證據見 [App-iOS-Sentry-Prebuild-2026-06-20T08-43-59Z.json](./App-iOS-Sentry-Prebuild-2026-06-20T08-43-59Z.json)。
- `mobile/src/platform/telemetry/nativeCrash.ts` 已新增 Sentry 初始化 adapter；只有在 `EXPO_PUBLIC_SENTRY_DSN` 或 `expo.extra.sentryDsn` 存在，且平台不是 web 時才啟用。
- Sentry 初始化使用 `sendDefaultPii: false`、`enableNativeCrashHandling: true`、`enableAutoSessionTracking: true`、`tracesSampleRate: 0`，並透過 `beforeSend` 移除 `user`、`request`、breadcrumbs，redact message / exception value / token-session 類 extra。
- iOS 持久化來源是 `mobile/app.json` 的 `@sentry/react-native/expo` config plugin；本機 generated / ignored `mobile/ios` 已經在 Release build 前補出 `mobile/ios/sentry.properties`、`sentry-xcode.sh` bundle phase 與 `Upload Debug Symbols to Sentry` / `sentry-xcode-debug-files.sh` dSYM upload phase；Android native project 已有 `android/sentry.properties` 與 `sentry.gradle`。
- 初始化採 fail-closed：若 Sentry native SDK 初始化拋錯，App 只回傳 `init_failed` 狀態，不讓 crash provider 阻塞 App 啟動。
- `ObservabilityBootstrap` 已把 native crash provider / enabled / reason 加入 App session start 與 boot span safe telemetry context。
- 本輪不提交 Sentry DSN、Sentry auth token、org slug 或 project slug；Sentry Expo plugin / source map upload 仍待 EAS / Sentry credentials 後補。

## 參考依據

- Expo 官方 Sentry guide：`https://docs.expo.dev/guides/using-sentry/`
- Sentry React Native Expo manual setup：`https://docs.sentry.io/platforms/react-native/manual-setup/expo/`
- npm package metadata：`@sentry/react-native@7.11.0`，peer dependencies 支援 `expo >=49.0.0`、`react >=17.0.0`、`react-native >=0.65.0`

## 已通過的本地驗證

| 命令 | 結果 | 備註 |
| --- | --- | --- |
| `npm --prefix mobile test -- --runInBand src/platform/telemetry/nativeCrash.test.js src/platform/telemetry/observability.test.js` | 已通過 | 覆蓋缺 DSN 時不初始化、Sentry init safe options、`beforeSend` redaction、init throw fail-closed、observability session context |
| `npm --prefix mobile run typecheck` | 已通過 | Sentry React Native SDK 型別與 native crash adapter 無 TypeScript 阻塞 |
| `npx expo install --check` | 已通過 | `@sentry/react-native`、`expo-notifications`、`react-native`、`react-native-worklets` 等 native dependency set 已對齊 Expo SDK 55 expected versions |
| `SENTRY_DISABLE_AUTO_UPLOAD=true DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npx expo run:ios --configuration Release --device "iPhone 17" --no-bundler` | 已通過 | iOS Release simulator build / install / launch 通過，且 `sentry-xcode.sh` bundle phase 與 `Upload Debug Symbols to Sentry` phase 均被 Xcode 執行；本地禁用 Sentry upload，不替代 source map / dSYM provider evidence |
| `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:preflight` | 已通過 | 30 suites / 134 tests passed，並通過 accessibility / copy / routes / features / platform boundary / typecheck / Expo web export / web route smoke / Maestro static gate / native readiness / Android readiness / release evidence / evidence redaction + sanitization / external evidence status + contract / handoff check + contract / external fixture contract / external evidence dry-run / external sign-off dry-run / Android sign-off dry-run / prerequisite report contract / workflow contract / env template contract / release completion audit + contract / goal completion audit + contract / release readiness；仍提示缺 UUID 形狀 EAS project id、Expo token、Apple / ASC / Sentry credentials、TestFlight / EAS artifact、真機、provider delivery 與 native crash runtime；release DB parity / telemetry runtime 現為已通過可刷新證據槽，需後續 EAS / Sentry credentials 與 runtime evidence |
| `npm --prefix mobile run release:completion:audit` | 已通過 / not complete report | 已驗證 native crash SDK configuration evidence；仍列出 native crash runtime evidence、EAS / TestFlight、physical device 與 provider delivery 等 release completion blockers；release DB parity 當前已由 pass evidence 解除，但後續 migration drift 後需重跑 |

## 明確未閉環項

以下事項仍不得宣稱已完成：

- 尚未配置 `EXPO_PUBLIC_SENTRY_DSN` / Sentry org / Sentry project / Sentry auth token。
- `@sentry/react-native/expo` config plugin 已進 `app.json`，iOS / Android native build phase 已接線，但尚未以真 org / project / auth token 產生 EAS source map / debug symbol upload evidence。
- 尚未產生 native crash runtime evidence，例如 TestFlight / physical device 上的 controlled crash capture 或 `App-Native-Crash-Runtime-*` 證據。
- 尚未建立 TestFlight crash-free sessions 或長期 crash-free baseline。
- 尚未建立 Sentry / Expo dashboard 截圖、issue id、release id 或 source map upload 證據。
