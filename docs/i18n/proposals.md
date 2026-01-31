# i18n 鍵值提案（QuickExperience/Result 頁）

## 建議鍵值對
- result.title: 判決結果
- result.subtitle: 基於AI分析的公正判決
- summary.title: 判決摘要
- responsibility.title: 責任分比例
- judgment.title: 完整判決書
- evidence.title: 證據上傳狀態
- evidence.failed: 證據上傳失敗
- evidence.failed.desc: 案件已創建，但證據上傳失敗。您可以在此重新上傳證據。
- evidence.pending: 證據待上傳
- evidence.pending.desc: 您有未上傳的證據文件，請在此上傳。
- evidence.action.reupload: 重新上傳證據
- evidence.action.uploading: 上傳中...
- actions.plan.locked: 生成和好方案（需註冊）
- actions.save.locked: 保存記錄（需註冊）
- register.prompt.title: 想要保存記錄和獲得更多功能？
- register.prompt.desc: 註冊後可查看歷史判決、生成和好方案、執行追蹤
- register.action.now: 立即註冊
- register.action.later: 稍後再說
- error.fetch.title: 獲取判決失敗
- error.session.title: Session 已過期
- error.judgment.title: 判決生成失敗
- error.retry: 重試
- error.back: 返回創建頁面
- pending.tip: 判決正在生成中，請稍候...
- pending.eta: 預計等待時間：30-60秒
- pending.long.message: 判決生成時間較長
- pending.long.desc: 已暫停自動輪詢，您可以選擇繼續等待，或重新提交生成請求。
- pending.long.action.wait: 繼續等待
- pending.long.action.regen: 重新生成
- pending.long.action.back: 返回創建頁

## 備註
- 以上鍵值覆蓋頁面顯示文本；下一步可映射至語言資源文件（如 zh-TW/en-US）。
- 若現有框架（vue-i18n/react-intl）未接入，可先落地字典與映射表，後續批量接入。
