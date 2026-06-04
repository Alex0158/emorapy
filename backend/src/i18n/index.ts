export type BackendLocale = 'zh-TW' | 'en-US';

const zhTWByCode: Record<string, string> = {
  UNAUTHORIZED: '未認證',
  FORBIDDEN: '無權限',
  TOKEN_EXPIRED: 'Token已過期',
  INVALID_CREDENTIALS: '郵箱或密碼錯誤',
  VALIDATION_ERROR: '驗證失敗',
  INVALID_EMAIL: '郵箱格式錯誤',
  WEAK_PASSWORD: '密碼強度不足',
  INVALID_CODE: '驗證碼錯誤',
  CODE_EXPIRED: '驗證碼已過期',
  SESSION_ID_REQUIRED: 'Session ID是必需的',
  INVALID_SESSION_ID: '無效的Session ID格式',
  SESSION_EXPIRED: 'Session已過期或不存在',
  NOT_FOUND: '資源不存在',
  EMAIL_EXISTS: '郵箱已存在',
  ALREADY_PAIRED: '已經有配對關係',
  CONFLICT: '資源衝突',
  CASE_NOT_READY: '案件尚未準備好',
  JUDGMENT_EXISTS: '判決已存在',
  FILE_TOO_LARGE: '文件過大',
  INVALID_FILE_TYPE: '文件類型不支持',
  TOO_MANY_FILES: '已達到文件數量上限',
  CASE_NOT_EDITABLE: '案件狀態不允許此操作',
  JUDGMENT_FAILED: '判決生成失敗，請稍後重試',
  INTERNAL_ERROR: '服務器內部錯誤',
  AI_SERVICE_ERROR: 'AI服務錯誤',
  DATABASE_ERROR: '數據庫錯誤',
  EXTERNAL_SERVICE_ERROR: '外部服務錯誤',
  RATE_LIMIT_EXCEEDED: '請求過於頻繁，請稍後再試',
  INVALID_JSON: '無效的JSON請求體',
  METHOD_NOT_ALLOWED: '僅支持 GET/HEAD 訪問文件',
  CONSENT_REQUIRED: '需要心理畫像同意',
  CONCURRENT_REQUEST: '已有進行中的請求',
  AI_CALL_FAILED: 'AI 調用失敗',
  MAX_TURNS_REACHED: '已達最大對話輪數',
  TURN_TOO_FAST: '回覆過快，請稍候',
  START_RATE_LIMIT: '開始訪談過於頻繁',
  PROCESSING_NOT_DONE: '處理尚未完成',
  PROCESSING_FAILED: '處理失敗',
  SESSION_COMPLETED: '此訪談已結束，不可繼續',
  JUDGMENT_STREAM_TIMEOUT: 'AI 服務響應超時，請稍後再試',
  JUDGMENT_STREAM_FAILED: 'AI 服務暫時不可用，請稍後重試',
  CHAT_AI_STREAM_FAILED: 'AI 回覆暫時失敗，請稍後再試',
  REPLAN_FAILED: 'AI 重調失敗',
};

const enUSByCode: Record<string, string> = {
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_CREDENTIALS: 'Invalid email or password',
  VALIDATION_ERROR: 'Validation failed',
  INVALID_EMAIL: 'Invalid email format',
  WEAK_PASSWORD: 'Password is too weak',
  INVALID_CODE: 'Invalid verification code',
  CODE_EXPIRED: 'Verification code has expired',
  SESSION_ID_REQUIRED: 'Session ID is required',
  INVALID_SESSION_ID: 'Invalid Session ID format',
  SESSION_EXPIRED: 'Session has expired or does not exist',
  NOT_FOUND: 'Resource not found',
  EMAIL_EXISTS: 'Email already exists',
  ALREADY_PAIRED: 'Already paired',
  CONFLICT: 'Resource conflict',
  CASE_NOT_READY: 'Case is not ready',
  JUDGMENT_EXISTS: 'Analysis already exists',
  FILE_TOO_LARGE: 'File is too large',
  INVALID_FILE_TYPE: 'Unsupported file type',
  TOO_MANY_FILES: 'Too many files',
  CASE_NOT_EDITABLE: 'Case status does not allow this action',
  JUDGMENT_FAILED: 'Analysis generation failed, please retry later',
  INTERNAL_ERROR: 'Internal server error',
  AI_SERVICE_ERROR: 'AI service error',
  DATABASE_ERROR: 'Database error',
  EXTERNAL_SERVICE_ERROR: 'External service error',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  INVALID_JSON: 'Invalid JSON request body',
  METHOD_NOT_ALLOWED: 'Only GET/HEAD is allowed for file access',
  CONSENT_REQUIRED: 'Psychological profile consent is required',
  CONCURRENT_REQUEST: 'A request is already in progress',
  AI_CALL_FAILED: 'AI call failed',
  MAX_TURNS_REACHED: 'Maximum conversation turns reached',
  TURN_TOO_FAST: 'Replying too fast, please wait',
  START_RATE_LIMIT: 'Starting interviews too frequently',
  PROCESSING_NOT_DONE: 'Processing is not yet complete',
  PROCESSING_FAILED: 'Processing failed',
  SESSION_COMPLETED: 'This interview has ended and cannot continue',
  JUDGMENT_STREAM_TIMEOUT: 'AI service timed out. Please try again later.',
  JUDGMENT_STREAM_FAILED: 'AI service is temporarily unavailable. Please try again later.',
  CHAT_AI_STREAM_FAILED: 'AI reply failed. Please try again later.',
  REPLAN_FAILED: 'AI adjustment failed',
};

const directEnUSMap: Record<string, string> = {
  '不允許的來源': 'Origin is not allowed',
  '資源已存在': 'Resource already exists',
  '服務器內部錯誤，請稍後再試': 'Internal server error, please try again later',
  '請求過於頻繁，請稍後再試': 'Too many requests, please try again later',
  '認證請求過於頻繁，請稍後再試': 'Too many auth requests, please try again later',
  '註冊請求過於頻繁，請稍後再試': 'Too many registration requests, please try again later',
  '驗證碼發送過於頻繁，請稍後再試': 'Verification code requests are too frequent, please try again later',
  'AI服務請求過於頻繁，請稍後再試': 'AI requests are too frequent, please try again later',
  '文件上傳過於頻繁，請稍後再試': 'Upload requests are too frequent, please try again later',
  '訪問過於頻繁，請稍後再試': 'Access requests are too frequent, please try again later',
  '註冊成功，請查收驗證郵件': 'Registration successful, please check your verification email',
  '登錄成功': 'Login successful',
  '驗證碼已發送': 'Verification code has been sent',
  '郵箱驗證成功': 'Email verified successfully',
  '重置密碼郵件已發送': 'Password reset email has been sent',
  '密碼重置成功': 'Password reset successful',
  '密碼過於簡單，請使用更複雜的密碼': 'Password is too weak, please choose a stronger password',
  '密碼長度至少8位': 'Password must be at least 8 characters',
  '密碼長度不能超過128位': 'Password cannot exceed 128 characters',
  '密碼必須包含字母': 'Password must contain letters',
  '密碼必須包含數字': 'Password must contain numbers',
  'Session創建成功': 'Session created successfully',
  'Session刷新成功': 'Session refreshed successfully',
  '案件已提交，AI正在分析中...': 'Case submitted, AI is analyzing...',
  '案件已提交': 'Case submitted',
  '案件不存在': 'Case not found',
  '判決生成中，請稍後再試': 'Analysis is being generated, please try again later',
  '案件已更新': 'Case updated',
  '判決已生成': 'Analysis generated',
  '和好方案已生成': 'Reconciliation plans generated',
  '方案已選擇': 'Plan selected',
  '邀請碼已生成': 'Invite code generated',
  '配對成功': 'Pairing successful',
  '配對已解除': 'Pairing removed',
  '資料更新成功': 'Profile updated successfully',
  '頭像更新成功': 'Avatar updated successfully',
  '個人背景已更新': 'Background profile updated',
  '關係檔案已更新': 'Relationship profile updated',
  '已同意心理畫像知情同意': 'Psychological profile consent recorded',
  '心理畫像相關資料已刪除': 'Psychological profile data deleted',
  '通知已記錄': 'Notification recorded',
  '已將通知標記為已讀': 'Notifications marked as read',
  '已封存這則通知': 'Notification archived',
  '已稍後提醒這則通知': 'Notification snoozed',
  '已處理這則通知': 'Notification processed',
  'Push token 已記錄': 'Push token recorded',
  'Push token 已撤銷': 'Push token revoked',
  '執行已確認': 'Execution confirmed',
  '打卡成功': 'Check-in successful',
  '已關聯內容': 'Content linked',
  '證據上傳成功': 'Evidence uploaded successfully',
  '證據已刪除': 'Evidence deleted',
  '聊天室已建立': 'Chat room created',
  '邀請已發送': 'Invite sent',
  '已加入聊天室': 'Joined chat room',
  '已拒絕邀請': 'Invite declined',
  '已發起判決': 'Analysis requested',
  '已離開聊天室': 'Left chat room',
  '已移除 B 方': 'Side B removed',
  '訊息已發送': 'Message sent',
  '案件已建立，等待對方陳述': 'Case created, waiting for the other person statement',
  '分析生成中，請稍後再試': 'Analysis is being generated, please try again later',
  '雙方陳述已完成，AI正在分析中...': 'Both statements completed, AI is analyzing...',
  '角色A陳述已記錄，請將設備交給角色B': 'Role A statement recorded. Please hand the device to Role B.',
  '訪談已開始': 'Interview started',
  '訪談回覆已提交': 'Interview response submitted',
  '訪談已結束': 'Interview ended',
  '訪談跳題已提交': 'Interview skip submitted',
  '訪談生成已停止': 'Interview generation stopped',
  '目前沒有進行中的訪談生成': 'No interview generation is currently in progress',
  '系統偵測到安全風險，已先切換到安全支持回應。': 'We detected a possible safety risk and switched to a safety-first response.',
  '已重試': 'Retried',
  '已記下你的承諾': 'Your commitment has been recorded',
  '已送出一起試試看的邀請': 'Invitation to try together sent',
  '已暫停這一輪修復旅程': 'This repair round has been paused',
  '已接受這一輪重調請求': 'This adjustment request has been accepted',
  '已恢復這一輪修復旅程': 'This repair round has been resumed',
  '分析已完成': 'Analysis completed',
  '已接受梳理結果': 'Analysis accepted',
  '已拒絕梳理結果': 'Analysis rejected',
  '已生成修復版回應': 'Repair response generated',
  '已記錄臨床品質指標': 'Clinical quality metrics recorded',
  '已取消 pending 通知': 'Pending notification canceled',
  '已批量取消 pending 通知': 'Pending notifications canceled in bulk',
  '已重新排入 pending 通知': 'Notification requeued as pending',
  '已更新人工恢復任務狀態': 'Manual recovery task status updated',
  '任務已觸發，請稍後查看執行結果日誌': 'Task triggered. Check execution logs later.',
  '案件已關聯到您的帳號': 'Case linked to your account',
  '無可關聯的案件': 'No case available to link',
  '接口不存在': 'API endpoint not found',
  '僅支持 GET/HEAD 訪問文件': 'Only GET/HEAD is allowed for file access',
  '無效的JSON請求體': 'Invalid JSON request body',
  '驗證碼嘗試過於頻繁，請15分鐘後再試': 'Too many verification attempts, please try again in 15 minutes',
  '重設密碼請求過於頻繁，請稍後再試': 'Too many password reset requests, please try again later',
  '重設密碼嘗試過於頻繁，請15分鐘後再試': 'Too many password reset attempts, please try again in 15 minutes',
  '配對嘗試過於頻繁，請稍後再試': 'Too many pairing attempts, please try again later',
  '該郵箱已被註冊': 'This email has already been registered',
  '文件大小超出限制': 'File size exceeds the limit',
  '文件數量超出限制': 'File count exceeds the limit',
  '無效的文件字段': 'Invalid file field',
  '文件上傳失敗': 'File upload failed',
  '操作正在進行中，請稍後再試': 'Operation in progress, please try again later',
  '缺少分布式鎖後端 (Redis)，請聯繫管理員': 'Distributed lock backend (Redis) is unavailable, please contact administrator',
  'Session刷新失敗': 'Session refresh failed',
  'Session更新失敗': 'Session update failed',
  'interview.maxTurns 不可小於 interview.softTarget': 'interview.maxTurns cannot be less than interview.softTarget',
  'interview.softTarget 不可大於 interview.maxTurns': 'interview.softTarget cannot be greater than interview.maxTurns',
  '缺少 B 方完整陳述': "Partner's complete statement is missing",
  '缺少可定位的時間錨點': 'A clear time anchor is missing',
  '事件經過與行為鏈條不足，難以重建衝突場景': 'The event sequence is too thin to reconstruct the conflict clearly',
  '因果描述不足，責任判斷不確定性偏高': 'Causal details are limited, so responsibility analysis remains uncertain',
  '情緒訊號不足，建議補充主觀感受': 'Emotional signals are limited; add subjective feelings',
  '需求/期待描述不足，難以生成可行修復建議': 'Needs or expectations are limited, making repair suggestions harder to generate',
  '情緒表達偏單一，可能放大單側詮釋偏差': 'Emotional expression is one-sided and may amplify interpretation bias',
  '互動循環線索不足，建議補充「觸發-反應-升級」描述': 'Interaction cycle clues are limited; add trigger-response-escalation details',
  'AI 重調失敗': 'AI adjustment failed',
  'AI 服務暫時不可用，請稍後重試': 'AI service is temporarily unavailable. Please try again later.',
  'AI 服務響應超時，請稍後再試': 'AI service timed out. Please try again later.',
  'AI 服務認證失敗（請檢查 OPENAI_API_KEY）': 'AI service authentication failed. Check OPENAI_API_KEY.',
  'AI 請求過於頻繁，請稍後再試': 'AI requests are too frequent. Please try again later.',
  '今日 AI 調用已達上限': "Today's AI usage limit has been reached.",
  'AI 返回內容異常，請重試': 'AI returned an invalid response. Please try again.',
  '服務內部錯誤': 'Internal service error',
  '請檢查 API Key 與網路連線': 'Check the API Key and network connection',
};

function translateDynamicBackendMessage(message: string): string | null {
  const providerConnectionSuccess = message.match(/^(.+) 連線測試成功$/);
  if (providerConnectionSuccess) {
    return `${providerConnectionSuccess[1]} connection test successful`;
  }

  const providerFallbackSuccess = message.match(/^(.+) 連線測試成功（fallback 驗證）$/);
  if (providerFallbackSuccess) {
    return `${providerFallbackSuccess[1]} connection test successful (fallback validation)`;
  }

  const providerTestFailure = message.match(/^(.+) 測試失敗：(.+)$/);
  if (providerTestFailure) {
    return `${providerTestFailure[1]} test failed: ${translateBackendMessage('en-US', providerTestFailure[2])}`;
  }

  const providerConnectionFailure = message.match(/^(.+) 連線測試失敗，請檢查 baseUrl\/API Key$/);
  if (providerConnectionFailure) {
    return `${providerConnectionFailure[1]} connection test failed. Check baseUrl/API Key`;
  }

  const providerTestInvalidResponse = message.match(/^(.+) 測試請求回應異常$/);
  if (providerTestInvalidResponse) {
    return `${providerTestInvalidResponse[1]} test request returned an invalid response`;
  }

  const providerImageInvalidResponse = message.match(/^(.+) 圖片生成回應異常$/);
  if (providerImageInvalidResponse) {
    return `${providerImageInvalidResponse[1]} image generation returned an invalid response`;
  }

  const providerMissingImage = message.match(/^(.+) 未回傳可用圖片 URL$/);
  if (providerMissingImage) {
    return `${providerMissingImage[1]} did not return a usable image URL`;
  }

  const imageOnlyProvider = message.match(/^(.+) 目前僅支援 image 任務$/);
  if (imageOnlyProvider) {
    return `${imageOnlyProvider[1]} currently supports image tasks only`;
  }

  const providerAuthFailure = message.match(/^(.+) 授權失敗，請檢查 API Key$/);
  if (providerAuthFailure) {
    return `${providerAuthFailure[1]} authorization failed. Check the API Key`;
  }

  const videoOnlyProvider = message.match(/^(.+) 目前僅支援 video 任務$/);
  if (videoOnlyProvider) {
    return `${videoOnlyProvider[1]} currently supports video tasks only`;
  }

  const videoTaskFailureWithDetail = message.match(/^(.+) 影像任務建立失敗：(.+)$/);
  if (videoTaskFailureWithDetail) {
    return `${videoTaskFailureWithDetail[1]} video task creation failed: ${translateBackendMessage('en-US', videoTaskFailureWithDetail[2])}`;
  }

  const videoTaskFailure = message.match(/^(.+) 影像任務建立失敗$/);
  if (videoTaskFailure) {
    return `${videoTaskFailure[1]} video task creation failed`;
  }

  const videoTaskMissingAsset = message.match(/^(.+) 回應未帶回可用影片 URL 或 taskId$/);
  if (videoTaskMissingAsset) {
    return `${videoTaskMissingAsset[1]} did not return a usable video URL or taskId`;
  }

  return null;
}

export function normalizeLocale(input?: string | null): BackendLocale {
  if (!input) return 'zh-TW';
  const lower = input.toLowerCase();
  if (lower.startsWith('en')) return 'en-US';
  return 'zh-TW';
}

export function resolveLocaleFromHeader(acceptLanguage?: string | string[]): BackendLocale {
  if (!acceptLanguage) return 'zh-TW';
  const raw = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
  const first = raw.split(',')[0]?.trim();
  return normalizeLocale(first);
}

export function translateErrorByCode(locale: BackendLocale, code: string, fallback?: string): string {
  const byCode = locale === 'en-US' ? enUSByCode : zhTWByCode;
  return byCode[code] ?? (fallback ? translateBackendMessage(locale, fallback) : code);
}

export function translateBackendMessage(locale: BackendLocale, message: string): string {
  if (locale === 'zh-TW') return message;
  if (message.startsWith('唯一約束違規:')) {
    const detail = message.slice('唯一約束違規:'.length).trim();
    const translatedDetail = detail === '未知字段' ? 'unknown field' : detail;
    return `Unique constraint violation: ${translatedDetail}`;
  }
  return directEnUSMap[message] ?? translateDynamicBackendMessage(message) ?? message;
}
