# App Android Toolchain Readiness 記錄

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-05-08
**上下文**：App M6 Android native build / emulator 前置工具鏈驗證
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-08`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0
**最後更新**：2026-05-08
**對應範圍**：`mobile/scripts/check-android-readiness.mjs`、`mobile/scripts/run-android-emulator-smoke.mjs`、`mobile/scripts/run-android-app-smoke.mjs`、`mobile/scripts/check-release-completion-audit.mjs`

---

## 本次確認到的狀態

2026-05-08 已在本機補齊 Android native toolchain 前置條件：

- Java：Homebrew OpenJDK 17，`/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java`
- Android SDK root：`/Users/alex/Library/Android/sdk`
- `adb`：`/Users/alex/Library/Android/sdk/platform-tools/adb`
- Android emulator CLI：`/Users/alex/Library/Android/sdk/emulator/emulator`
- `sdkmanager`：`/Users/alex/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager`

本輪也把 readiness / release completion audit 腳本調整為可在 Homebrew Java 17 佈局下穩定調用 `sdkmanager`，避免只因 macOS 系統 Java wrapper 未配置而誤報工具鏈 blocker。

## 已通過的驗證

| 命令 | 結果 | 備註 |
| --- | --- | --- |
| `brew install --cask android-commandlinetools android-platform-tools` | 已通過 | 安裝 Android command-line tools 與 platform-tools；不包含 app runtime build artifact |
| `yes \| JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home sdkmanager --sdk_root="$HOME/Library/Android/sdk" "cmdline-tools;latest" "platform-tools" "emulator" "platforms;android-36"` | 已通過 | 接受 Android SDK license，安裝最小 SDK / emulator / platform-tools package |
| `npm --prefix mobile run android:check:strict` | 已通過 | 確認 Android package、versionCode、adaptive icon assets、permissions、Expo plugins、EAS Android profiles、SDK root、Java、adb、emulator、sdkmanager |
| `npm --prefix mobile run android:emulator:smoke -- --avd=CJ_Pixel_9_API_36 --timeout-ms=240000` | 已通過 | 已建立 `CJ_Pixel_9_API_36` AVD，啟動 Android 16 / API 36 arm64 emulator，並觀察 `sys.boot_completed=1`；證據見 [App-Android-Emulator-2026-05-08T10-27-04-283Z.json](./App-Android-Emulator-2026-05-08T10-27-04-283Z.json) |
| `npm --prefix mobile run android:app:smoke` | 已通過 | 已在 `CJ_Pixel_9_API_36` / `emulator-5554` 上完成 release APK `assembleRelease`、`adb install -r`、`com.cj.motherbearcourt/.MainActivity` launch 與 foreground window 驗證；證據見 [App-Android-App-2026-05-08T10-43-22-314Z.json](./App-Android-App-2026-05-08T10-43-22-314Z.json) |
| `npm --prefix mobile run android:maestro:smoke -- --skip-build` | 已通過 | 已在 `CJ_Pixel_9_API_36` / `emulator-5554` 上完成 Maestro static gate、Android strict readiness、Android app runtime gate 與 M0-M5 7/7 Maestro flows；證據見 [App-Android-Maestro-2026-05-08T16-22-39-948Z.json](./App-Android-Maestro-2026-05-08T16-22-39-948Z.json) |
| `npm --prefix mobile run release:completion:audit:strict` | 預期失敗 | 已把 `android_native_toolchain_evidence`、`android_emulator_runtime_evidence`、`android_app_runtime_evidence`、`android_full_flow_evidence` 與 `native_imagepicker_upload_evidence` 轉為 verified；仍因 EAS / TestFlight / physical device / APNs / native crash runtime / release DB parity 等外部或 runtime 證據缺口失敗 |

## 明確未閉環項

以下事項仍不得宣稱已完成：

- 已建立 Android AVD、完成 emulator boot smoke，且已在 Android emulator 上安裝 / 啟動 CJ App release APK，並完成 Android Maestro 7/7 flow smoke。
- 已產生本機 Gradle release APK runtime smoke 與 Android emulator full-flow smoke；尚未產生 EAS Android build artifact 或 Play Store artifact。
- 尚未取得 Android physical device evidence。
- 本證據只證明 Android toolchain prerequisites present，不替代 Android App runtime、Push delivery、selected-media ImagePicker upload 或 TestFlight / store release evidence。
