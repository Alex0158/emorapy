import { describe, expect, it } from '@jest/globals';
import { translateBackendMessage, translateErrorByCode } from '../../../src/i18n';

describe('backend i18n', () => {
  it('translates backend-owned response messages to en-US', () => {
    expect(translateBackendMessage('en-US', 'interview.maxTurns 不可小於 interview.softTarget')).toBe(
      'interview.maxTurns cannot be less than interview.softTarget'
    );
    expect(translateBackendMessage('en-US', '缺少 B 方完整陳述')).toBe("Partner's complete statement is missing");
    expect(translateBackendMessage('en-US', '訪談不存在或無權限')).toBe(
      'Interview not found or you do not have access'
    );
    expect(translateBackendMessage('en-US', '訪談缺少可回覆輪次')).toBe(
      'Interview is missing a turn that can be replied to'
    );
    expect(translateBackendMessage('en-US', '服務內部錯誤')).toBe('Internal service error');
    expect(translateBackendMessage('en-US', 'AI 重調失敗')).toBe('AI adjustment failed');
  });

  it('translates errorHandler special-case response messages to en-US', () => {
    expect(translateBackendMessage('en-US', '該郵箱已被註冊')).toBe(
      'This email has already been registered'
    );
    expect(translateBackendMessage('en-US', '文件大小超出限制')).toBe('File size exceeds the limit');
    expect(translateBackendMessage('en-US', '文件數量超出限制')).toBe('File count exceeds the limit');
    expect(translateBackendMessage('en-US', '無效的文件字段')).toBe('Invalid file field');
    expect(translateBackendMessage('en-US', '文件上傳失敗')).toBe('File upload failed');
  });

  it('translates development unique constraint diagnostics without leaving CJK fallback suffixes', () => {
    expect(translateBackendMessage('en-US', '唯一約束違規: 未知字段')).toBe(
      'Unique constraint violation: unknown field'
    );
    expect(translateBackendMessage('en-US', '唯一約束違規: email')).toBe(
      'Unique constraint violation: email'
    );
  });

  it('translates unknown AppError code fallback messages through backend message map', () => {
    expect(translateErrorByCode('en-US', 'CORS_ORIGIN_DENIED', '不允許的來源')).toBe(
      'Origin is not allowed'
    );
    expect(translateErrorByCode('zh-TW', 'CORS_ORIGIN_DENIED', '不允許的來源')).toBe('不允許的來源');
    expect(translateErrorByCode('en-US', 'UNKNOWN_WITHOUT_FALLBACK')).toBe('UNKNOWN_WITHOUT_FALLBACK');
  });

  it('keeps zh-TW backend messages unchanged', () => {
    expect(translateBackendMessage('zh-TW', '缺少 B 方完整陳述')).toBe('缺少 B 方完整陳述');
  });

  it('translates dynamic media provider response messages without localizing provider names', () => {
    expect(translateBackendMessage('en-US', 'NanoBananaPro 連線測試成功')).toBe(
      'NanoBananaPro connection test successful'
    );
    expect(translateBackendMessage('en-US', 'NanoBananaPro 連線測試成功（fallback 驗證）')).toBe(
      'NanoBananaPro connection test successful (fallback validation)'
    );
    expect(translateBackendMessage('en-US', 'NanoBananaPro 測試失敗：請檢查 API Key 與網路連線')).toBe(
      'NanoBananaPro test failed: Check the API Key and network connection'
    );
    expect(translateBackendMessage('en-US', 'Seedance 連線測試失敗，請檢查 baseUrl/API Key')).toBe(
      'Seedance connection test failed. Check baseUrl/API Key'
    );
  });

  it('translates media provider service errors without localizing provider identifiers', () => {
    expect(translateBackendMessage('en-US', 'Provider catalog 不存在')).toBe('Provider catalog not found');
    expect(translateBackendMessage('en-US', '不支援的 providerKey')).toBe('Unsupported providerKey');
    expect(translateBackendMessage('en-US', 'Provider NanoBananaPro 不支援圖片生成')).toBe(
      'Provider NanoBananaPro does not support image generation'
    );
    expect(translateBackendMessage('en-US', 'Provider Seedance 不支援影片生成')).toBe(
      'Provider Seedance does not support video generation'
    );
    expect(translateBackendMessage('en-US', 'Provider 實作尚未部署：nanobananapro')).toBe(
      'Provider implementation is not deployed yet: nanobananapro'
    );
    expect(
      translateBackendMessage(
        'en-US',
        'NanoBananaPro 缺少 API Key，請先以 system config 寫入 media.provider.nanobananapro 或於測試輸入中提供 apiKey'
      )
    ).toBe(
      'NanoBananaPro is missing an API Key. Add media.provider.nanobananapro in system config or provide apiKey in the test input'
    );
    expect(translateBackendMessage('en-US', 'Seedance 請求逾時')).toBe(
      'Seedance request timed out'
    );
    expect(translateBackendMessage('en-US', 'Seedance 請求過頻，請稍後再試')).toBe(
      'Seedance request rate is too high. Please try again later'
    );
    expect(translateBackendMessage('en-US', 'Seedance 服務異常 (503)')).toBe(
      'Seedance service is unavailable (503)'
    );
    expect(translateBackendMessage('en-US', 'Seedance 任務完成但未回傳影片 URL')).toBe(
      'Seedance task completed but did not return a video URL'
    );
    expect(translateBackendMessage('en-US', 'Seedance 影像任務失敗')).toBe(
      'Seedance video task failed'
    );
    expect(translateBackendMessage('en-US', 'Seedance 影像任務失敗：Seedance 請求逾時')).toBe(
      'Seedance video task failed: Seedance request timed out'
    );
    expect(translateBackendMessage('en-US', 'Seedance 任務輪詢逾時')).toBe(
      'Seedance task polling timed out'
    );
    expect(translateBackendMessage('en-US', 'Seedance 任務輪詢逾時：Seedance 服務異常 (503)')).toBe(
      'Seedance task polling timed out: Seedance service is unavailable (503)'
    );
    expect(translateBackendMessage('zh-TW', '不支援的 providerKey')).toBe('不支援的 providerKey');
  });

  it('translates pairing profile and content service errors without localizing API fields', () => {
    expect(translateBackendMessage('en-US', '無法生成唯一邀請碼')).toBe(
      'Unable to generate a unique invite code'
    );
    expect(translateBackendMessage('en-US', '邀請碼無效')).toBe('Invalid invite code');
    expect(translateBackendMessage('en-US', '邀請碼已過期')).toBe('Invite code has expired');
    expect(translateBackendMessage('en-US', '邀請碼已使用')).toBe('Invite code has already been used');
    expect(translateBackendMessage('en-US', '不能與自己配對')).toBe('You cannot pair with yourself');
    expect(translateBackendMessage('en-US', '當前沒有可解除的配對')).toBe(
      'There is no active pairing to cancel'
    );
    expect(translateBackendMessage('en-US', '無權限解除此配對')).toBe(
      'You do not have permission to cancel this pairing'
    );
    expect(translateBackendMessage('en-US', '臨時配對數量達到上限，請稍後重試')).toBe(
      'Temporary pairing limit reached, please try again later'
    );
    expect(translateBackendMessage('en-US', '配對不存在')).toBe('Pairing not found');
    expect(translateBackendMessage('en-US', '無權訪問此配對檔案')).toBe(
      'You do not have permission to access this pairing profile'
    );
    expect(translateBackendMessage('en-US', '請求體必須為 JSON 對象')).toBe(
      'Request body must be a JSON object'
    );
    expect(translateBackendMessage('en-US', '內容不存在')).toBe('Content not found');
    expect(translateBackendMessage('en-US', '需要認證')).toBe('Authentication is required');
    expect(translateBackendMessage('en-US', 'case_id、content_id 為必填')).toBe(
      'case_id and content_id are required'
    );
    expect(translateBackendMessage('en-US', 'relation 只能是 recommend, similar, waiting')).toBe(
      'relation must be one of recommend, similar, waiting'
    );
    expect(translateBackendMessage('zh-TW', '邀請碼無效')).toBe('邀請碼無效');
  });

  it('translates auth service fallback errors including dynamic lockout duration', () => {
    expect(translateBackendMessage('en-US', '帳號已被暫時鎖定，請7分鐘後再試')).toBe(
      'Account is temporarily locked. Please try again in 7 minutes'
    );
    expect(translateBackendMessage('en-US', '帳號未激活')).toBe('Account is not active');
    expect(translateBackendMessage('en-US', '請先完成郵箱驗證')).toBe(
      'Please complete email verification first'
    );
    expect(translateBackendMessage('en-US', '請稍後再試')).toBe('Please try again later');
    expect(translateBackendMessage('zh-TW', '帳號未激活')).toBe('帳號未激活');
  });

  it('translates evidence upload and delete controller errors to en-US', () => {
    expect(translateBackendMessage('en-US', 'Header 與 Query 的 Session ID 不一致')).toBe(
      'Header and query Session ID do not match'
    );
    expect(translateBackendMessage('en-US', '無權限上傳證據')).toBe(
      'You do not have permission to upload evidence'
    );
    expect(translateBackendMessage('en-US', '案件狀態不允許上傳證據')).toBe(
      'The case status does not allow evidence upload'
    );
    expect(translateBackendMessage('en-US', '請選擇要上傳的文件')).toBe(
      'Please select a file to upload'
    );
    expect(translateBackendMessage('en-US', '證據安全聲明未通過')).toBe(
      'Evidence safety assertion was not accepted'
    );
    expect(translateBackendMessage('en-US', '每個案件最多只能上傳3張圖片')).toBe(
      'Each case can have at most 3 uploaded images'
    );
    expect(translateBackendMessage('en-US', '證據不存在')).toBe('Evidence not found');
    expect(translateBackendMessage('en-US', '無權限刪除此證據')).toBe(
      'You do not have permission to delete this evidence'
    );
    expect(translateBackendMessage('zh-TW', '證據不存在')).toBe('證據不存在');
  });

  it('translates auth admin and media middleware errors to en-US', () => {
    expect(translateBackendMessage('en-US', '未提供認證Token')).toBe(
      'Authentication token was not provided'
    );
    expect(translateBackendMessage('en-US', '用戶不存在或未激活')).toBe(
      'User does not exist or is not active'
    );
    expect(translateBackendMessage('en-US', 'Token已失效，請重新登入')).toBe(
      'Token is no longer valid. Please log in again.'
    );
    expect(translateBackendMessage('en-US', 'Token無效')).toBe('Token is invalid');
    expect(translateBackendMessage('en-US', 'Token驗證失敗')).toBe('Token verification failed');
    expect(translateBackendMessage('en-US', '訪問被拒絕')).toBe('Access denied');
    expect(translateBackendMessage('en-US', '生產環境不允許公開訪問上傳資源')).toBe(
      'Public access to uploaded resources is not allowed in production'
    );
    expect(translateBackendMessage('en-US', '公開模式僅允許讀取請求')).toBe(
      'Public mode only allows read requests'
    );
    expect(translateBackendMessage('en-US', '當前文件路徑未在 PUBLIC_UPLOAD_PATHS 白名單')).toBe(
      'Current file path is not in the PUBLIC_UPLOAD_PATHS allowlist'
    );
    expect(translateBackendMessage('en-US', '簽名已失效')).toBe('Signature is no longer valid');
    expect(translateBackendMessage('en-US', '未授權的資源訪問')).toBe('Unauthorized resource access');
    expect(translateBackendMessage('en-US', '未提供管理員認證 Token')).toBe(
      'Admin authentication token was not provided'
    );
    expect(translateBackendMessage('en-US', '管理員帳號不存在或未啟用')).toBe(
      'Admin account does not exist or is not enabled'
    );
    expect(translateBackendMessage('en-US', '管理員 Token 已失效，請重新登入')).toBe(
      'Admin token is no longer valid. Please log in again.'
    );
    expect(translateBackendMessage('en-US', '管理員 JWT 過期時間配置缺失')).toBe(
      'Admin JWT expiry configuration is missing'
    );
    expect(translateBackendMessage('en-US', '管理員 JWT 配置缺失')).toBe(
      'Admin JWT configuration is missing'
    );
    expect(translateBackendMessage('en-US', '管理員 Token 已過期')).toBe(
      'Admin token has expired'
    );
    expect(translateBackendMessage('en-US', '管理員 Token 無效')).toBe(
      'Admin token is invalid'
    );
    expect(translateBackendMessage('en-US', '管理員未認證')).toBe('Admin is not authenticated');
    expect(translateBackendMessage('en-US', '管理員權限不足')).toBe('Admin permission is insufficient');
    expect(translateBackendMessage('zh-TW', '未提供認證Token')).toBe('未提供認證Token');
  });

  it('translates admin controller and service errors to en-US', () => {
    expect(translateBackendMessage('en-US', 'limit/offset 必須為數字')).toBe(
      'limit/offset must be numeric'
    );
    expect(translateBackendMessage('en-US', 'from 必須為合法 ISO 日期')).toBe(
      'from must be a valid ISO date'
    );
    expect(translateBackendMessage('en-US', 'email/password/name 為必填')).toBe(
      'email, password, and name are required'
    );
    expect(translateBackendMessage('en-US', '管理員帳號已存在，請改用登入')).toBe(
      'Admin account already exists. Please log in instead'
    );
    expect(translateBackendMessage('en-US', '管理員帳號或密碼錯誤')).toBe(
      'Invalid admin account or password'
    );
    expect(translateBackendMessage('en-US', '不可停用自己的管理員帳號')).toBe(
      'You cannot deactivate your own admin account'
    );
    expect(translateBackendMessage('en-US', '系統至少需保留一位啟用中的 super_admin')).toBe(
      'The system must keep at least one active super_admin'
    );
    expect(translateBackendMessage('en-US', '敏感基礎密鑰不可由後台配置管理')).toBe(
      'Sensitive base secrets cannot be managed from the admin console'
    );
    expect(translateBackendMessage('en-US', 'AI Stream 不存在')).toBe('AI Stream not found');
    expect(translateBackendMessage('zh-TW', '管理員帳號或密碼錯誤')).toBe(
      '管理員帳號或密碼錯誤'
    );
  });

  it('translates admin managed config validation patterns without localizing config keys', () => {
    expect(translateBackendMessage('en-US', 'feature.flags 必須為 object')).toBe(
      'feature.flags must be an object'
    );
    expect(translateBackendMessage('en-US', 'feature.flags keys 不可超過 200')).toBe(
      'feature.flags cannot have more than 200 keys'
    );
    expect(translateBackendMessage('en-US', 'feature.flags key 長度不可超過 80: feature.flags.sample')).toBe(
      'feature.flags key length cannot exceed 80: feature.flags.sample'
    );
    expect(translateBackendMessage('en-US', 'feature.flags key 格式不合法: 1-invalid')).toBe(
      'feature.flags key format is invalid: 1-invalid'
    );
    expect(translateBackendMessage('en-US', 'feature.flags.release.enabled 只允許 string/number/boolean')).toBe(
      'feature.flags.release.enabled only allows string/number/boolean values'
    );
    expect(translateBackendMessage('en-US', 'interview.maxTurns 必須為數字')).toBe(
      'interview.maxTurns must be numeric'
    );
    expect(translateBackendMessage('en-US', 'interview.maxTurns 必須介於 5 ~ 100')).toBe(
      'interview.maxTurns must be between 5 and 100'
    );
    expect(translateBackendMessage('en-US', 'admin.alert.rules[0] 必須為 object')).toBe(
      'admin.alert.rules[0] must be an object'
    );
    expect(translateBackendMessage('en-US', 'admin.alert.rules[0].key 為必填')).toBe(
      'admin.alert.rules[0].key is required'
    );
    expect(translateBackendMessage('en-US', 'admin.alert.rules[0].threshold 必須為 >= 0 的數字')).toBe(
      'admin.alert.rules[0].threshold must be a number greater than or equal to 0'
    );
    expect(translateBackendMessage('en-US', 'admin.alert.rules[0].windowMinutes 必須介於 1 ~ 1440')).toBe(
      'admin.alert.rules[0].windowMinutes must be between 1 and 1440'
    );
    expect(translateBackendMessage('en-US', 'media.provider.nanobananapro 設定必須是 object')).toBe(
      'media.provider.nanobananapro config must be an object'
    );
    expect(translateBackendMessage('en-US', 'media.provider.nanobananapro 的 apiKey 需為非空字串')).toBe(
      'media.provider.nanobananapro apiKey must be a non-empty string'
    );
    expect(translateBackendMessage('en-US', 'media.provider.seedance 的 baseUrl 需為合法 URL')).toBe(
      'media.provider.seedance baseUrl must be a valid URL'
    );
    expect(translateBackendMessage('en-US', 'media.provider.seedance 的 timeoutMs 需為正整數')).toBe(
      'media.provider.seedance timeoutMs must be a positive integer'
    );
    expect(translateBackendMessage('zh-TW', 'feature.flags 必須為 object')).toBe(
      'feature.flags 必須為 object'
    );
  });

  it('translates user profile and avatar controller errors to en-US', () => {
    expect(translateBackendMessage('en-US', '用戶不存在')).toBe('User not found');
    expect(translateBackendMessage('en-US', '沒有可更新的字段')).toBe(
      'No updatable fields were provided'
    );
    expect(translateBackendMessage('en-US', '頭像域名不被允許')).toBe('Avatar domain is not allowed');
    expect(translateBackendMessage('en-US', '頭像URL格式無效')).toBe('Avatar URL format is invalid');
    expect(translateBackendMessage('en-US', '缺少頭像文件')).toBe('Avatar file is missing');
    expect(translateBackendMessage('en-US', '頭像僅支持圖片格式')).toBe(
      'Avatar only supports image files'
    );
    expect(translateBackendMessage('zh-TW', '缺少頭像文件')).toBe('缺少頭像文件');
  });

  it('translates chat service errors and keeps public Analysis terminology', () => {
    expect(translateBackendMessage('en-US', '訊息發送過於頻繁，請稍後再試')).toBe(
      'Messages are being sent too frequently, please try again later'
    );
    expect(translateBackendMessage('en-US', '你沒有該聊天室權限')).toBe(
      'You do not have permission to access this chat room'
    );
    expect(translateBackendMessage('en-US', '只有發起方可發送邀請')).toBe(
      'Only the initiator can send invites'
    );
    expect(translateBackendMessage('en-US', '邀請不存在')).toBe('Invite not found');
    expect(translateBackendMessage('en-US', '邀請碼不存在')).toBe('Invite code not found');
    expect(translateBackendMessage('en-US', '聊天室當前狀態不允許接受邀請')).toBe(
      'The current chat room status does not allow accepting invites'
    );
    expect(translateBackendMessage('en-US', 'cursor 必須為有效 ISO 時間')).toBe(
      'cursor must be a valid ISO timestamp'
    );
    expect(translateBackendMessage('en-US', '只有聊天室成員可發起梳理結果')).toBe(
      'Only chat room members can request an Analysis'
    );
    expect(translateBackendMessage('en-US', '目前版本需由 A 方確認後發起梳理結果')).toBe(
      'This version requires Side A to confirm before requesting an Analysis'
    );
    expect(translateBackendMessage('en-US', '梳理結果生成中，請稍後')).toBe(
      'Analysis is being generated, please wait'
    );
    expect(translateBackendMessage('en-US', '部分訊息不存在或不可納入梳理結果')).toBe(
      'Some messages do not exist or cannot be included in the Analysis'
    );
    expect(translateBackendMessage('en-US', 'A 方訊息不足，無法轉梳理結果')).toBe(
      'Side A messages are insufficient, so this chat cannot be converted to an Analysis'
    );
    expect(translateBackendMessage('en-US', '需登入才能離開聊天室')).toBe(
      'Log in to leave the chat room'
    );
    expect(translateBackendMessage('en-US', '只有發起方可以移除 B 方')).toBe(
      'Only the initiator can remove Side B'
    );
    expect(translateBackendMessage('zh-TW', '只有聊天室成員可發起梳理結果')).toBe(
      '只有聊天室成員可發起梳理結果'
    );
  });

  it('translates judgment service errors and keeps public Analysis terminology', () => {
    expect(translateBackendMessage('en-US', '無權限生成梳理結果')).toBe(
      'You do not have permission to generate this Analysis'
    );
    expect(translateBackendMessage('en-US', '請稍後再重試生成梳理結果')).toBe(
      'Please wait before retrying Analysis generation'
    );
    expect(translateBackendMessage('en-US', '梳理結果不存在')).toBe('Analysis not found');
    expect(translateBackendMessage('en-US', '無權限修復此梳理結果')).toBe(
      'You do not have permission to repair this Analysis'
    );
    expect(translateBackendMessage('en-US', '無權限提交此梳理結果指標')).toBe(
      'You do not have permission to submit metrics for this Analysis'
    );
    expect(translateBackendMessage('en-US', '無權限訪問此梳理結果')).toBe(
      'You do not have permission to access this Analysis'
    );
    expect(translateBackendMessage('en-US', '梳理結果生成失敗，請點擊重試')).toBe(
      'Analysis generation failed. Please click retry'
    );
    expect(translateBackendMessage('en-US', '責任分比例必須為非負且總和 100')).toBe(
      'Responsibility ratios must be non-negative and sum to 100'
    );
    expect(translateBackendMessage('en-US', '無效的責任分比例格式')).toBe(
      'Invalid responsibility ratio format'
    );
    expect(translateBackendMessage('en-US', '回饋內容過短')).toBe('Feedback is too short');
    expect(translateBackendMessage('en-US', 'AI服務響應超時，請稍後再試')).toBe(
      'AI service timed out. Please try again later.'
    );
    expect(translateBackendMessage('en-US', 'AI服務暫時不可用，請稍後重試')).toBe(
      'AI service is temporarily unavailable. Please try again later.'
    );
    expect(translateBackendMessage('zh-TW', '梳理結果不存在')).toBe('梳理結果不存在');
  });

  it('translates AI service fallback errors to en-US', () => {
    expect(translateBackendMessage('en-US', 'AI返回空內容')).toBe('AI returned empty content');
    expect(translateBackendMessage('en-US', 'AI服務認證失敗')).toBe(
      'AI service authentication failed'
    );
    expect(translateBackendMessage('en-US', 'AI服務暫時不可用')).toBe(
      'AI service is temporarily unavailable'
    );
    expect(translateBackendMessage('en-US', '今日AI服務調用已達上限')).toBe(
      'Today AI service usage limit has been reached'
    );
    expect(translateBackendMessage('en-US', '無法解析AI響應')).toBe(
      'Unable to parse AI response'
    );
    expect(translateBackendMessage('en-US', 'AI響應格式無效（非陣列）')).toBe(
      'Invalid AI response format (not an array)'
    );
    expect(translateBackendMessage('en-US', '無法解析 AI 重調結果')).toBe(
      'Unable to parse AI adjustment result'
    );
    expect(translateBackendMessage('zh-TW', 'AI服務認證失敗')).toBe('AI服務認證失敗');
  });

  it('translates notification controller and service errors to en-US', () => {
    expect(translateBackendMessage('en-US', 'notification payload.path 必須為已允許的前台相對路由')).toBe(
      'notification payload.path must be an allowed frontend relative route'
    );
    expect(translateBackendMessage('en-US', '批量取消通知必須提供至少一個篩選條件')).toBe(
      'Bulk notification cancellation requires at least one filter'
    );
    expect(translateBackendMessage('en-US', '只有 pending 通知可以取消')).toBe(
      'Only pending notifications can be canceled'
    );
    expect(translateBackendMessage('en-US', '已由 Admin 取消的通知不可重送')).toBe(
      'Notifications canceled by Admin cannot be resent'
    );
    expect(translateBackendMessage('en-US', '只有 failed 通知可以重送')).toBe(
      'Only failed notifications can be resent'
    );
    expect(translateBackendMessage('en-US', 'token 或 device_id 至少需要一項')).toBe(
      'At least one of token or device_id is required'
    );
    expect(translateBackendMessage('en-US', 'template_code 為必填欄位')).toBe(
      'template_code is required'
    );
    expect(translateBackendMessage('zh-TW', '只有 pending 通知可以取消')).toBe(
      '只有 pending 通知可以取消'
    );
  });

  it('translates validation utility errors to en-US while preserving dynamic values', () => {
    expect(translateBackendMessage('en-US', '角色A陳述不能為空')).toBe(
      'Role A statement cannot be empty'
    );
    expect(translateBackendMessage('en-US', '回應方陳述長度必須至少30字')).toBe(
      '回應方陳述 must be at least 30 characters'
    );
    expect(translateBackendMessage('en-US', '陳述長度不能超過2000字')).toBe(
      '陳述 length cannot exceed 2000 characters'
    );
    expect(translateBackendMessage('en-US', '案件ID格式無效')).toBe(
      '案件ID format is invalid'
    );
    expect(translateBackendMessage('en-US', '證據URL必須是數組')).toBe(
      'Evidence URLs must be an array'
    );
    expect(translateBackendMessage('en-US', '最多只能上傳3張圖片')).toBe(
      'You can upload at most 3 images'
    );
    expect(translateBackendMessage('en-US', '證據URL[1]格式錯誤')).toBe(
      'Evidence URL[1] format is incorrect'
    );
    expect(translateBackendMessage('en-US', '證據URL[2]格式無效')).toBe(
      'Evidence URL[2] format is invalid'
    );
    expect(translateBackendMessage('en-US', '證據URL[0]僅支持 HTTPS')).toBe(
      'Evidence URL[0] only supports HTTPS'
    );
    expect(translateBackendMessage('en-US', '郵箱格式錯誤')).toBe('Email format is invalid');
    expect(translateBackendMessage('en-US', '密碼不能為空')).toBe('Password cannot be empty');
    expect(translateBackendMessage('en-US', '密碼長度至少8位')).toBe(
      'Password must be at least 8 characters'
    );
    expect(translateBackendMessage('en-US', '密碼必須包含字母')).toBe(
      'Password must contain letters'
    );
    expect(translateBackendMessage('en-US', '密碼必須包含數字')).toBe(
      'Password must contain numbers'
    );
    expect(translateBackendMessage('en-US', '責任分比例必須是數字')).toBe(
      'Responsibility ratio must be numeric'
    );
    expect(translateBackendMessage('en-US', '責任分比例不能為負數')).toBe(
      'Responsibility ratio cannot be negative'
    );
    expect(translateBackendMessage('en-US', '責任分比例總和必須為100%')).toBe(
      'Responsibility ratios must sum to 100%'
    );
    expect(translateBackendMessage('zh-TW', '回應方陳述長度必須至少30字')).toBe(
      '回應方陳述長度必須至少30字'
    );
  });

  it('translates file service upload validation errors to en-US', () => {
    expect(translateBackendMessage('en-US', '文件大小不能超過10MB')).toBe(
      'File size cannot exceed 10MB'
    );
    expect(translateBackendMessage('en-US', '只支持JPG、PNG、GIF、MP4格式')).toBe(
      'Only JPG, PNG, GIF, and MP4 formats are supported'
    );
    expect(translateBackendMessage('en-US', '不支持的文件類型')).toBe('Unsupported file type');
    expect(translateBackendMessage('en-US', '不支持的文件擴展名')).toBe(
      'Unsupported file extension'
    );
    expect(translateBackendMessage('en-US', '文件類型驗證失敗：文件內容與聲稱的類型不匹配')).toBe(
      'File type validation failed: file content does not match the declared type'
    );
    expect(translateBackendMessage('zh-TW', '不支持的文件類型')).toBe('不支持的文件類型');
  });

  it('translates case service errors to en-US without localizing mode values', () => {
    expect(translateBackendMessage('en-US', 'Session創建失敗')).toBe('Session creation failed');
    expect(translateBackendMessage('en-US', '案件創建失敗，請稍後再試')).toBe(
      'Case creation failed, please try again later'
    );
    expect(translateBackendMessage('en-US', '配對關係未激活')).toBe('Pairing is not active');
    expect(translateBackendMessage('en-US', '無權限訪問此配對')).toBe(
      'You do not have permission to access this pairing'
    );
    expect(translateBackendMessage('en-US', '正式案件 mode 只能是 remote 或 collaborative')).toBe(
      'Formal case mode must be remote or collaborative'
    );
    expect(translateBackendMessage('en-US', '協作模式需同時提供雙方陳述')).toBe(
      'Collaborative mode requires both statements'
    );
    expect(translateBackendMessage('en-US', '無權限提交此案件')).toBe(
      'You do not have permission to submit this case'
    );
    expect(translateBackendMessage('en-US', '遠程/協作模式需等待回應方陳述後才能提交')).toBe(
      'Remote/collaborative mode must wait for the partner statement before submission'
    );
    expect(translateBackendMessage('en-US', '無權限更新此案件')).toBe(
      'You do not have permission to update this case'
    );
    expect(translateBackendMessage('en-US', '只有發起方可以修改發起方陳述')).toBe(
      'Only the initiator can edit the initiator statement'
    );
    expect(translateBackendMessage('en-US', '只有回應方可以修改回應方陳述')).toBe(
      'Only the partner can edit the partner statement'
    );
    expect(translateBackendMessage('en-US', '無權限訪問此案件')).toBe(
      'You do not have permission to access this case'
    );
    expect(translateBackendMessage('en-US', '協作案件不存在')).toBe('Collaborative case not found');
    expect(translateBackendMessage('en-US', 'Session 不匹配')).toBe('Session does not match');
    expect(translateBackendMessage('en-US', '角色A陳述不能為空')).toBe(
      'Role A statement cannot be empty'
    );
    expect(translateBackendMessage('zh-TW', '正式案件 mode 只能是 remote 或 collaborative')).toBe(
      '正式案件 mode 只能是 remote 或 collaborative'
    );
  });

  it('translates reconciliation service errors and keeps public Analysis terminology', () => {
    expect(translateBackendMessage('en-US', '無效的和好方案格式')).toBe(
      'Invalid reconciliation plan format'
    );
    expect(translateBackendMessage('en-US', '修復旅程不存在')).toBe('Repair journey not found');
    expect(translateBackendMessage('en-US', '和好方案不存在')).toBe('Reconciliation plan not found');
    expect(translateBackendMessage('en-US', '無權限操作此方案')).toBe(
      'You do not have permission to operate on this plan'
    );
    expect(translateBackendMessage('en-US', '梳理結果不存在')).toBe('Analysis not found');
    expect(translateBackendMessage('en-US', '無權限生成和好方案')).toBe(
      'You do not have permission to generate reconciliation plans'
    );
    expect(translateBackendMessage('en-US', '此案件尚未綁定已登入當事人，不能生成修復旅程')).toBe(
      'This case is not linked to a signed-in participant, so a repair journey cannot be generated'
    );
    expect(
      translateBackendMessage(
        'en-US',
        '此梳理結果路由不允許生成一般共同修復方案，請改用安全支持或低壓退出方向'
      )
    ).toBe(
      'This Analysis route does not allow a standard shared repair plan. Use safety support or a low-pressure exit direction instead'
    );
    expect(
      translateBackendMessage(
        'en-US',
        '此梳理結果路由只允許 solo 修復，不允許邀請伴侶加入修復旅程'
      )
    ).toBe(
      'This Analysis route only allows solo repair and does not allow inviting a partner into the repair journey'
    );
    expect(translateBackendMessage('en-US', '無權限查看此梳理結果的和好方案')).toBe(
      'You do not have permission to view reconciliation plans for this Analysis'
    );
    expect(translateBackendMessage('en-US', '請先承諾此方案，再開始今天的第一步')).toBe(
      "Commit to this plan before starting today's first step"
    );
    expect(translateBackendMessage('en-US', '無權限恢復此修復旅程')).toBe(
      'You do not have permission to resume this repair journey'
    );
    expect(translateBackendMessage('zh-TW', '此梳理結果路由只允許 solo 修復，不允許邀請伴侶加入修復旅程')).toBe(
      '此梳理結果路由只允許 solo 修復，不允許邀請伴侶加入修復旅程'
    );
  });

  it('translates execution service errors to en-US', () => {
    expect(translateBackendMessage('en-US', '無權限執行此方案')).toBe(
      'You do not have permission to execute this plan'
    );
    expect(translateBackendMessage('en-US', '無權限查看此修復旅程')).toBe(
      'You do not have permission to view this repair journey'
    );
    expect(translateBackendMessage('en-US', '請先在和好方案中選擇此方案再確認執行')).toBe(
      'Select this reconciliation plan before confirming execution'
    );
    expect(translateBackendMessage('en-US', '請先選擇並確認此方案後再記錄進展')).toBe(
      'Select and confirm this plan before recording progress'
    );
    expect(translateBackendMessage('en-US', '無權限調整此修復旅程')).toBe(
      'You do not have permission to adjust this repair journey'
    );
    expect(translateBackendMessage('en-US', '目前這一輪狀態無法重新調整')).toBe(
      'This repair round cannot be adjusted again in its current state'
    );
    expect(translateBackendMessage('zh-TW', '目前這一輪狀態無法重新調整')).toBe(
      '目前這一輪狀態無法重新調整'
    );
  });

  it('uses public Analysis terminology for backend judgment response messages', () => {
    expect(translateErrorByCode('en-US', 'JUDGMENT_FAILED')).toBe(
      'Analysis generation failed, please retry later'
    );
    expect(translateBackendMessage('en-US', '判決生成中，請稍後再試')).toBe(
      'Analysis is being generated, please try again later'
    );
    expect(translateBackendMessage('en-US', '判決已生成')).toBe('Analysis generated');
  });

  it('translates repair journey response action messages to en-US', () => {
    expect(translateBackendMessage('en-US', '已記下你暫時不加入的選擇')).toBe(
      'Your choice not to join for now has been recorded'
    );
    expect(translateBackendMessage('en-US', '已記下你需要一點時間')).toBe(
      'Your need for more time has been recorded'
    );
    expect(translateBackendMessage('en-US', '已同步你已查看這個邀請')).toBe(
      'Your invitation view has been synced'
    );
  });
});
