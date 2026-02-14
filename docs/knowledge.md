# 知識庫條目（本次任務）

## Improve 2026-02-06：PDCA 改善計劃執行
- 類型：Improve + PDCA + 審查
- 詳述：依 PDCA 方法論執行一輪改善。命名規範與七大原則複查通過（無違規）；可選修復項篩選後本輪不實施代碼重構；i18n 審查已記錄可替換點，本輪無字典變更。產出 docs/plan/improve-pdca-20260206.md（複查結果、前後比較、confidence、pre-PR 狀態）。驗證：後端 ESLint 0 錯誤、單元測試 738 通過；前端 ReadLints 0 錯誤。
- 相關檔案：docs/plan/improve-pdca-20260206.md、docs/audit/per-file-audit-20260206.md、docs/naming-conventions.md
- confidence: high

## Improve 2026-02-06：i18n 可選替換實施（繼續）
- 類型：Improve + i18n
- 詳述：依 improve-pdca-20260206 記錄之可選替換點，補齊 zh-TW 鍵（review.*、settings.*、message.getProfileFail/saveSuccess/saveFail、error.session.expiredHint、message.judgmentRetryHint/judgmentUnavailable/retryOrLater/sessionIdMissing、result.restart/skipToJudgment 等），並在 Case/Review、Profile/Settings、QuickExperience/Result 三頁將硬編碼中文替換為 t()。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Case/Review/index.tsx、frontend/src/pages/Profile/Settings/index.tsx、frontend/src/pages/QuickExperience/Result/index.tsx、docs/plan/improve-pdca-20260206.md
- confidence: high

## Improve 2026-02-06：i18n 登錄頁（繼續）
- 類型：Improve + i18n
- 詳述：登錄頁 Auth/Login 全面改用 i18n：新增 auth.login.* 與 message.loginSuccess/loginFail/emailNotVerified/resendVerifyFail，表單標籤、按鈕、提示與 SEO 文案均改為 t()。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Auth/Login/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 註冊頁（繼續）
- 類型：Improve + i18n
- 詳述：註冊頁 Auth/Register 全面改用 i18n：新增 auth.register.* 與 message.emailFirst/codeSent/sendCodeFail/waitCountdown/codeFull/verifySuccess/codeError/verifyFail/passwordMismatch/registerSuccess/registerFail，四步驟標題、表單、驗證碼與成功頁文案均改為 t()；倒計時提示使用 message.waitCountdown.replace('{count}', countdown)。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Auth/Register/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 忘記密碼頁（繼續）
- 類型：Improve + i18n
- 詳述：忘記密碼頁 Auth/ForgotPassword 全面改用 i18n：新增 auth.forgot.* 與 message.resetEmailSent/sendResetFail/resetSuccess/resetFail，三步驟、表單、驗證碼與成功區塊文案均改為 t()；複用 auth.login.email*、auth.register.* 驗證碼/密碼相關鍵。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Auth/ForgotPassword/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 首頁（繼續）
- 類型：Improve + i18n
- 詳述：首頁 Home 全面改用 i18n：新增 home.*（title、description、skipToContent、hero、features、process），SEO、Hero 標題與按鈕、核心功能四張卡片、使用流程四步驟均改為 t()；功能與步驟數據改為 titleKey/descKey/ariaKey，渲染時 t(key)；流程步驟 aria-label 使用 home.process.stepAria 替換 {number}、{title}。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Home/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 快速體驗創建頁（繼續）
- 類型：Improve + i18n
- 詳述：快速體驗創建頁 QuickExperience/Create 全面改用 i18n：新增 quickCreate.* 與 message.fillPlaintiffFirst/defendantDraftDone/draftSaved/shortcutSaveDraft/shortcutSubmit/completePlaintiff/submitFail/evidenceUploadFailCaseCreated，SEO、引導、自動保存、布局標籤、角色A/B 標題與提示、套用模板/自動代寫、證據區、註冊引導、提交區與快捷鍵說明均改為 t()；複用 register.prompt.desc、register.action.now、message.sessionIdMissing、message.evidenceUploadSuccess。模板內容（三條陳述範例）保留硬編碼。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/QuickExperience/Create/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 404 頁（繼續）
- 類型：Improve + i18n
- 詳述：404 頁 NotFound 改用 i18n：新增 notFound.title、notFound.subTitle、notFound.backHome，標題、副標與按鈕改為 t()。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/NotFound/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 案件列表頁（繼續）
- 類型：Improve + i18n
- 詳述：案件列表頁 Case/List 全面改用 i18n：新增 caseList.*（title、description、pageLabel、heading、totalCount、createNew、createFirst、filtersLabel、statusAll/statusDraft/statusSubmitted/statusInProgress/statusCompleted/statusCancelled、typeAll/typeLife/typeConsumption/typeSocial/typeValues/typeEmotion/typeOther、sortLatest/sortOldest/sortStatus、searchPlaceholder、viewDetail、viewDetailAria、empty、paginationTotal）與 message.getCaseListFail；SEO、頁標、篩選/排序/搜索、空狀態、分頁總數與錯誤提示均改為 t()；複用 common.loading。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Case/List/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 案件詳情頁（繼續）
- 類型：Improve + i18n
- 詳述：案件詳情頁 Case/Detail 全面改用 i18n：新增 caseDetail.*（titleSuffix、pageLabel、actionsLabel、backList、backListAria、edit、editAria、descLabel、caseId/caseType/subType/subTypeNone、mode/modeRemote/modeCollaborative/modeQuick、createdAt/updatedAt/submittedAt/completedAt、plaintiffStatement/defendantStatement、actionSectionLabel、submitCase/submitCaseAria/submitHint、viewReview/viewReviewAria、viewJudgment/viewJudgmentAria）與 message.pleaseLogin/noPermissionViewCase/submitCaseSuccess/submitCaseFail/noPermissionSubmitCase/editComingSoon/judgmentNotReady；SEO、操作區、Descriptions 標籤、審理模式、原告/被告陳述、按鈕與錯誤/成功提示均改為 t()；複用 common.loading、common.caseNotFound、common.getCaseFail、message.caseIdMissing、message.getJudgmentFail。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Case/Detail/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 創建案件頁（繼續）
- 類型：Improve + i18n
- 詳述：完整模式創建案件頁 Case/Create 全面改用 i18n：新增 caseCreate.*（title、description、pageLabel、heading、subtitle、formLabel、basicInfo、caseTitle/caseTitleRequired/caseTitlePlaceholder、caseType/caseTypeRequired/caseTypePlaceholder、subType/subTypePlaceholder、mode/modeRemoteLabel/modeCollaborativeLabel/modeHint、statements、plaintiffPlaceholder/defendantPlaceholder、evidenceTitle/evidenceExtra、submitBtn/creating/submitHint、pairingRequired/pairingDesc/goPairing）與 message.pairingRequired/completeBothStatements/untitledCase/createCaseSuccess/createCaseFail；配對提示區、SEO、表單各區、案件類型選項、審理模式、原告/被告佔位、證據區、提交按鈕與成功/錯誤提示均改為 t()；複用 caseList.typeLife 等、caseDetail.plaintiffStatement/defendantStatement、message.evidenceUploadSuccess、message.evidenceUploadFailCaseCreated。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Case/Create/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 判決詳情頁（繼續）
- 類型：Improve + i18n
- 詳述：判決詳情頁 Judgment/Detail 全面改用 i18n：新增 judgmentDetail.*（pageTitle、description、pageLabel、actionsLabel、back/backAria、feedbackTitle、ratingLabel/ratingAria、actionsGroupLabel、accept/acceptAria、reject/rejectAria、generatePlans/generatePlansAria、acceptedAlert/rejectedAlert、acceptModalTitle/acceptModalConfirm/acceptModalRating、rejectModalTitle/rejectModalConfirm、docTitle）與 message.getJudgmentDetailFail/acceptJudgmentSuccess/rejectJudgmentSuccess/operationFail/generatePlansSuccess/generatePlansFail/judgmentNotFound；SEO、返回、標題區、責任分比例、判決書、反饋區、評分與接受/拒絕/生成和好方案、彈窗與提示均改為 t()；複用 result.title、result.subtitle、responsibility.title、common.loading。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Judgment/Detail/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 執行儀表板（繼續）
- 類型：Improve + i18n
- 詳述：執行儀表板 Execution/Dashboard 全面改用 i18n：新增 execDashboard.*（title、description、pageLabel、heading、subtitle、empty、emptyHint、goCaseList、inProgress、completed、checkIn、planFallbackTitle、estimatedDays）與 message.getExecutionStatusFail；SEO、標題與副標、空狀態與提示、進行中/已完成區、卡片標題後綴與預計天數、去打卡按鈕與錯誤提示均改為 t()；複用 common.loading。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Execution/Dashboard/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 執行打卡頁（繼續）
- 類型：Improve + i18n
- 詳述：執行打卡頁 Execution/CheckIn 全面改用 i18n：新增 execCheckIn.*（title、description、pageLabel、heading、back/backAria、progressLabel、recordsCount、formLabel、notesLabel/notesRequired/notesPlaceholder、photosLabel、uploadBtn、submit、uploadingPhotos、historyTitle）與 message.photoUploadFailContinue/checkinSuccess/checkinFail；SEO、返回、進度與打卡次數、表單標籤與佔位、提交按鈕與歷史記錄標題、成功/警告/錯誤提示均改為 t()；複用 common.loading、message.getExecutionStatusFail。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Execution/CheckIn/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 和好方案列表頁（繼續）
- 類型：Improve + i18n
- 詳述：和好方案列表頁 Reconciliation/List 全面改用 i18n：新增 reconList.*（title、description、pageLabel、heading、subtitle、filtersLabel、difficultyAll/difficultyEasy/difficultyMedium/difficultyHard、typeAll/typeActivity/typeCommunication/typeIntimacy、generating、empty、generatePlans、selected、viewDetail/viewDetailAria、selectPlan/selectPlanAria/planSelectedAria、estimatedDays、estimatedTbd）與 message.getPlansFail/generatePlansSuccessCount/selectPlanSuccess/selectPlanFail；SEO、標題與副標、篩選、加載/生成提示、空狀態、方案卡片的已選擇/查看詳情/選擇方案與預計天數、成功/錯誤提示均改為 t()；複用 message.generatePlansFail、common.loading。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Reconciliation/List/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 和好方案詳情頁 + 個人資料頁 + 配對管理頁（繼續）
- 類型：Improve + i18n
- 詳述：三頁一次完成 i18n。（1）Reconciliation/Detail：新增 reconDetail.*（pageTitle、pageLabel、back/backAria、planType/difficultyLevel/estimatedDuration/timeCost/moneyCost/emotionCost、contentTitle、selectThisPlan、startExecution、execHintTitle/execHintDesc）與 message.planNotFound/planIdMissing/getPlanDetailFail/startExecutionSuccess/startExecutionFail；複用 reconList 難度與類型、reconList.estimatedDays/estimatedTbd、common.loading、message.selectPlanSuccess/selectPlanFail。（2）Profile/Index：新增 profileIndex.*（title、description、pageLabel、heading、formLabel、avatarLabel/uploadAvatar/avatarHint、nicknameLabel/nicknamePlaceholder、emailLabel、save/saveAria）與 message.getProfileIndexFail/profileUpdateSuccess/updateFail/avatarOnlyImage/avatarSizeLimit/avatarUploadFail/avatarSuccess；複用 common.loading。（3）Profile/Pairing：新增 pairing.*（title、description、pageLabel、heading、pairedTitle/pairedDesc、pairingInfo/pairingId/user1/user2、cancelPairing、pendingTitle/pendingDesc、inviteCode/copy/inviteHint、createTitle/createDesc/createButton、joinTitle/joinDesc/joinPlaceholder/joinButton）與 message.createPairingSuccess/createPairingFail/enterInviteCode/joinPairingSuccess/joinPairingFail/copyInviteSuccess/cancelPairingSuccess/cancelPairingFail；複用 common.loading。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Reconciliation/Detail/index.tsx、frontend/src/pages/Profile/Index/index.tsx、frontend/src/pages/Profile/Pairing/index.tsx
- confidence: high

## Improve 2026-02-06：i18n 漏改修復 + Header + ErrorFallback + NetworkStatus（繼續）
- 類型：Improve + i18n
- 詳述：修復 Profile/Pairing、Reconciliation/Detail 漏改的 message 字串（createPairingSuccess/createPairingFail、selectPlanSuccess/selectPlanFail）。新增 nav.*（home、quickExperience、profile、settings、logout、logo、login、register）並在 Header 導航欄全面改用 t()。新增 errorFallback.*（title、unknown、retry、reload、hint）與 networkStatus.*（offline、offlineDesc），ErrorFallback、NetworkStatus 組件改用 t()。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/Profile/Pairing/index.tsx、frontend/src/pages/Reconciliation/Detail/index.tsx、frontend/src/components/layout/Header.tsx、frontend/src/components/common/ErrorFallback.tsx、frontend/src/components/common/NetworkStatus/index.tsx
- confidence: high

## Improve 2026-02-06：i18n Footer + ConfirmModal + FileUpload（繼續）
- 類型：Improve + i18n
- 詳述：Footer 新增 footer.copyright、footer.tagline 並改用 t()。ConfirmModal 預設按鈕改用 common.confirm、common.cancel。FileUpload 新增 fileUpload.*（linkExpiredRefresh、uploadSuccessCount、uploadFail、formatNotAllowed、sizeLimit、countLimit、deleteEvidenceFail、linkInvalid、uploadBtn、uploadedCount），所有 message 與「上傳」「已上傳 X / Y 個文件」改為 t()。
- 相關檔案：frontend/src/assets/i18n/zh-TW.ts、frontend/src/components/layout/Footer.tsx、frontend/src/components/common/ConfirmModal/index.tsx、frontend/src/components/business/FileUpload/index.tsx
- confidence: high

- 日期：2026-01-31
- 類型：Improve + Audit + i18n + Test
- 詳述：\n  - 拆分 QuickExperience/Result 七區塊為子元件，提升可讀性與維護性，行為不變。\n  - 生成 i18n 鍵值提案（標題、提示、操作、錯誤、等待文案），覆蓋主要文本。\n  - 新增後端 retry 工具單元測試，覆蓋 transient 成功與 4xx 停止。\n  - 啟動本地前端預覽驗證拆分效果；安全審計確認無硬編碼憑證，Helmet/CORS 配置存在。\n- 相關檔案：\n  - docs/plan/workflow.md\n  - docs/i18n/proposals.md\n  - frontend/src/pages/QuickExperience/Result/components/*\n  - backend/tests/unit/utils/retry.test.ts\n- confidence: high

## FixBug 2026-01-31：輸入驗證缺失
- 類型：缺陷 / 安全加固
- 問題：\n  - GET /api/v1/execution/status 的 plan_id 查詢參數未驗證，可能傳入無效 UUID 導致 Prisma 異常。\n  - GET/PUT /api/v1/profile/relationship/:pairingId 的 pairingId 路徑參數未驗證，同上。\n- 方案：\n  - 新增 executionStatusQuerySchema、pairingIdParamSchema，強制 UUID 格式驗證。\n  - 在對應路由加入 validate 中間件。\n- 預防：新 API 路由需檢查 params/query/body 是否皆有對應 Joi schema 驗證。\n- 相關檔案：\n  - backend/src/utils/validation.ts\n  - backend/src/routes/execution.routes.ts\n  - backend/src/routes/profile.routes.ts\n  - backend/src/routes/content.routes.ts\n  - backend/tests/unit/utils/validation-schemas.test.ts\n- 補充：GET /api/v1/content-items/recommendations/:caseId 的 caseId 已加入 caseIdParamSchema 驗證。\n- confidence: high

## Improve 2026-01-31：PDCA 改進
- 類型：重構 + i18n + 測試
- 詳述：DRY 提取 normalizeJudgment 至 utils/judgment.ts；補齊 zh-TW 的 error.*、pending.*、actions.createAnother；修復 case.service 隱式 any；新增 judgment utils 單元測試。\n- 相關檔案：backend/src/utils/judgment.ts、backend/tests/unit/utils/judgment.test.ts、frontend/src/assets/i18n/zh-TW.ts、ActionsSection.tsx\n- confidence: high

## Improve 2026-02-01：PDCA 改進（第二輪）
- 類型：文檔 + 單元測試 + i18n
- 詳述：新增 docs/naming-conventions.md 整合前後端命名規範；新增 utils/request.test.ts（9 用例）；補齊 zh-TW 的 common.*、message.* 鍵；QuickExperience/Result 5 處 message 改用 t()。
- 相關檔案：docs/naming-conventions.md、backend/tests/unit/utils/request.test.ts、frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/QuickExperience/Result/index.tsx
- 單元測試：129 passed（+9 request utils）
- Lint：Backend 0 Error
- confidence: high

## Improve 2026-02-01：PDCA 全局改善（第三輪）
- 類型：計劃 + 審查 + 知識庫
- 詳述：依 PDCA 方法論做全局檢查。命名規範與七大原則審計已確認（docs/naming-conventions.md、docs/audit/seven-principles-devsecops-20260201.md）；制定 docs/plan/improve-global-20260201.md；IDE Linter 對 backend/src、frontend/src 0 錯誤；i18n 字典已與 proposals 對齊，本輪無代碼變更。
- 相關檔案：docs/plan/improve-global-20260201.md、docs/knowledge.md
- 備註：前端 npm run lint 若報 esquery 模組缺失，為依賴安裝問題，建議 frontend 目錄執行 npm ci。
- confidence: high

## Improve 2026-02-01：PDCA 全局改善（第四輪）
- 類型：計劃實施 + Linter + 單測 + 知識庫
- 詳述：依 PDCA 計劃執行第四輪。複查命名規範與七大原則（無新違規）；更新 docs/plan/improve-global-20260201.md 第四輪區塊與清單；IDE Linter 對 backend/src、frontend/src 0 錯誤；後端 npm run test:unit 590 passed；總結與知識庫更新。
- 相關檔案：docs/plan/improve-global-20260201.md、docs/knowledge.md
- 單測：後端 590 passed；前端建議在 frontend 目錄執行 npm run test:run 或依 CI 驗證（若報 vitest 未找到，請先 npm install）。
- Linter：IDE 0 錯誤；CLI 本地可能超時，以 CI 為準。
- confidence: high

## Improve 2026-02-01：類型安全收斂（第四輪延續）
- 類型：類型安全
- 詳述：frontend request 與通用類型收斂 any。request.ts：config 使用 ExtendedAxiosRequestConfig、錯誤響應使用 ApiErrorResponseBody/ErrorLike、requestWithRetryWrapper 泛型改為 unknown、shouldRetry 參數改為 unknown；common.ts：ApiResponse 預設泛型改為 unknown、ApiError.details 改為 unknown。
- 相關檔案：frontend/src/services/request.ts、frontend/src/types/common.ts
- Linter：0 錯誤。
- confidence: high

## Improve 2026-02-01：類型安全收斂（API 與 Store）
- 類型：類型安全
- 詳述：frontend API 與 store 收斂 any。case.ts：catch 改為 error: unknown 並用 { code?: string } 縮窄；uploadEvidence/deleteEvidence 的 config 改為明確型別（headers/params）。judgment.ts：getJudgmentByCaseId 的 catch 改為 error: unknown 並縮窄。executionStore.ts：三處 catch 改為 error: unknown，用 error instanceof Error 取 message。
- 相關檔案：frontend/src/services/api/case.ts、frontend/src/services/api/judgment.ts、frontend/src/store/executionStore.ts
- Linter：0 錯誤。
- confidence: high

## Improve 2026-02-01：類型安全收斂（pairing API 與其餘 Store）
- 類型：類型安全
- 詳述：pairing.ts：getPairingStatus 的 catch 改為 error: unknown 並用 { code?: string } 縮窄。caseStore.ts、judgmentStore.ts：所有 catch 改為 error: unknown，用 error instanceof Error 取 message。reconciliationStore.ts：filters 改為 PlanFilters、preferences 改為 PlanPreferences；三處 catch 改為 error: unknown 與 instanceof Error；導出 PlanFilters 供型別複用。
- 相關檔案：frontend/src/services/api/pairing.ts、frontend/src/store/caseStore.ts、frontend/src/store/judgmentStore.ts、frontend/src/store/reconciliationStore.ts
- Linter：0 錯誤。
- confidence: high

## Improve 2026-02-01：類型安全收斂（頁面 catch 與 params/filters）
- 類型：類型安全
- 詳述：頁面層收斂 any。Execution/Dashboard、Case/List、Reconciliation/List、QuickExperience/Result、Case/Detail、Case/Review、Judgment/Detail：所有 catch(error: any) 改為 catch(error: unknown)，用 error instanceof Error 或 (error as { code?: string; message?: string }) 取訊息；Case/List params 改為明確型別；Reconciliation/List filters 改為 { difficulty?: string; type?: string }；Result 的 case_.evidences 改為直接使用 Case.evidences；Case/Detail 兩處 catch 用 ErrShape 取 response.data.error。
- 相關檔案：frontend/src/pages/Execution/Dashboard/index.tsx、Case/List/index.tsx、Reconciliation/List/index.tsx、QuickExperience/Result/index.tsx、Case/Detail/index.tsx、Case/Review/index.tsx、Judgment/Detail/index.tsx
- Linter：0 錯誤。
- confidence: high

## Improve 2026-02-01：類型安全收斂（其餘頁面與組件）
- 類型：類型安全
- 詳述：Execution/CheckIn：handleSubmit 改為 CheckInFormValues、plan 用 getPlanById 回傳型別（judgment.case_id）、catch 改為 unknown。QuickExperience/Create：evidenceFiles.map 改為 (f: { url?: string })、filter/map 改為 type guard、catch 改為 unknown。Profile/Index：handleSubmit 改為 Parameters<typeof updateProfile>[0]、三處 catch 改為 unknown。Profile/Pairing、Profile/Settings、Reconciliation/Detail、Case/Create、Auth/Login、Auth/Register、Auth/ForgotPassword：所有 catch 與 handleSubmit values 改為明確型別或 unknown。FileUpload：caseData.evidences、Evidence 型別、ItemWithResponse/FileWithResponse 取代 as any、catch 改為 unknown。ConfirmModal：onCancel 改為 undefined as unknown as MouseEvent<HTMLButtonElement>，並 import MouseEvent。
- 相關檔案：frontend/src/pages/Execution/CheckIn、QuickExperience/Create、Profile/Index、Profile/Pairing、Profile/Settings、Reconciliation/Detail、Case/Create、Auth/Login、Auth/Register、Auth/ForgotPassword、frontend/src/components/business/FileUpload、common/ConfirmModal
- Linter：0 錯誤。
- confidence: high

## Improve 2026-02-01：類型安全收斂（utils、hooks、types）
- 類型：類型安全
- 詳述：補遺：Case/Create 第二處 evidenceFiles filter/map、Profile/Pairing/Reconciliation List 遺漏的 catch 改為 unknown。utils/retry：shouldRetry 與 catch 改為 unknown，lastError 用 Error 包裝。sessionStore、useSession、usePollingJudgment：catch 改為 unknown 並取 message/code。utils/logger：data/error 改為 unknown。utils/apiError：details 改 unknown、isApiError(error: unknown)。utils/responseHandler：handleApiError/isSuccessResponse/isErrorResponse 參數改 unknown。utils/download：downloadJSON data 改 unknown。utils/helpers：debounce/throttle 泛型改 unknown[]、deepClone 用 Record<string, unknown>。utils/polling：PollingOptions<T>、onSuccess(data: T)。types/session：session_data 改 unknown。utils/performance：measurePerformance 泛型改 unknown[]、LCP lastEntry 用 LCPEntry。utils/analytics：Window.gtag 宣告、trackUserAction details 改 Record<string, unknown>。hooks/usePerformance：useDebounce/useThrottle 泛型改 unknown[]。
- 相關檔案：frontend/src/utils/retry、logger、apiError、responseHandler、download、helpers、polling、performance、analytics、frontend/src/hooks/usePerformance、useSession、usePollingJudgment、frontend/src/store/sessionStore、frontend/src/types/session、frontend/src/pages/Case/Create、Profile/Pairing、Reconciliation/List
- Linter：0 錯誤。
- confidence: high

## Improve 2026-02-01：類型安全收斂（前端測試與後端）
- 類型：類型安全
- 詳述：前端測試：caseType.test.ts 的 '未知' as any 改為 as string；helpers.test.ts 的 (cloned as any).b/[1] 改為明確型別；statusTags.test.tsx 的 'unknown' as any 改為 as unknown as CaseStatus。後端：utils/retry 的 shouldRetry/catch 改為 unknown；config/database 的 migrationError 改為 unknown 並用 ErrShape；app.ts 的 err/err2 改為 unknown；middleware/logger 的 logData 改為 Record<string, unknown>；utils/judgment 新增 JudgmentLike、normalizeJudgment 泛型與回傳型；controllers/profile 的 sanitizePayload body/sanitized 改為 unknown/Record<string, unknown>；types/ai.types 的 isResponsibilityRatio/isReconciliationPlanContent 參數改為 unknown；services/notification 的 where 與 payload 改為明確型與 Prisma.InputJsonValue 斷言；services/content 的 where 改為 Record<string, unknown>；services/profile 的 data 改為 Record<string, unknown>。
- 相關檔案：frontend/src/utils/caseType.test、helpers.test、statusTags.test；backend/src/utils/retry、config/database、app、middleware/logger、utils/judgment、controllers/profile、types/ai.types、services/notification、content、profile
- 後端單測：63 passed。
- confidence: high

## Improve 2026-02-01：類型安全收斂（後端服務層）
- 類型：類型安全
- 詳述：file.service：processImage/processVideo 的 stat fallback 改為 fallbackStat: { size: number } 與 'size' in stat 檢查。judgment.service：catch(err/error/updateError: any) 改為 unknown；tx: any 改為 Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]；transaction 內 catch(error: any) 改為 unknown 並用 ErrShape；normalizeJudgment(judgment as any) 改為 judgment as JudgmentLike。auth.service：新增 AuthUserResponse 介面；register/login 回傳型改為 { user: AuthUserResponse; token: string } 等。reconciliation.service：judgment as any 改為 JudgmentWithCase/JudgmentWithRatio；where: any 改為 Record<string, unknown>。ai.service：signal as any 改為 AbortSignal；shouldRetry/catch 改為 unknown，error.status 改為 (error as { status? })；catch 內 error.status 改為 err。pairing.service：signAvatar(user: any) 改為 UserWithAvatar 型別。
- 相關檔案：backend/src/services/file、judgment、auth、reconciliation、ai、pairing
- 後端單測：63 passed。
- confidence: high

## Improve 2026-02-01：類型安全收斂（第五輪 - case/execution 與其餘 any）
- 類型：類型安全
- 詳述：後端 case.service：tx 改為 Prisma.TransactionClient；updateData 改為 Prisma.CaseUpdateInput；新增 PairingUserWithAvatar、CaseWithJudgmentPayload；evidences/pairing/judgment 簽名與 normalizeJudgment 使用明確型別與 CaseWithJudgmentPayload['judgment'] 斷言。execution.service：新增 CaseWithPlansForExecution、PlanWithRecords；allPlans 與 forEach 改為 Prisma 推導型別。後端其餘：user.controller 的 updateData 改為 Record<string, unknown>；utils/cache 的 CacheEntry<any> 改為 CacheEntry<unknown>；errors 的 details 改為 Record<string, unknown>；types/common 的 ApiResponse<T = unknown>、error.details 改為 Record<string, unknown>。前端：Case/Create、QuickExperience/Create 的 evidenceFiles 改為 UploadFile[]；QuickExperience 型別謂詞改為 UploadFile & { originFileObj: File }，uploadEvidence 參數以 File[] 斷言；utils/cache 改為 CacheItem<unknown>；url/requestHelper 的 params 改為 Record<string, unknown> 或查詢參數型別；useApi 的 P 改為 unknown[]。
- 相關檔案：backend/src/services/case.service、execution.service、controllers/user.controller、utils/cache、utils/errors、types/common；frontend/src/pages/Case/Create、QuickExperience/Create、utils/cache、url、requestHelper、hooks/useApi；docs/plan/improve-global-20260201.md
- Linter：0 錯誤；後端單測通過。
- confidence: high

## Improve 2026-02-01：類型安全收斂（第五輪延續 - 測試檔）
- 類型：類型安全
- 詳述：後端 utils/request.ts 註解改寫為「避免各處重複對 req 做型別斷言」。前端測試：i18n、download、responseHandler、caseType 的 as any 改為 as unknown 或明確型別（CaseType、Parameters<typeof setLocale>[0]、(node: Node) => Node）；LazyImage、useIntersectionObserver 的 (global as any).IntersectionObserver 改為 (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver。剩餘僅 Vitest API expect.any(...)，無需改動。
- 相關檔案：backend/src/utils/request.ts；frontend/src/utils/i18n.test、download.test、responseHandler.test、caseType.test；frontend/src/components/common/LazyImage/index.test、hooks/useIntersectionObserver.test；docs/plan/improve-global-20260201.md
- Linter：0 錯誤；後端單測通過。
- confidence: high
