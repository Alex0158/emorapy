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
  JUDGMENT_EXISTS: 'Judgment already exists',
  FILE_TOO_LARGE: 'File is too large',
  INVALID_FILE_TYPE: 'Unsupported file type',
  TOO_MANY_FILES: 'Too many files',
  CASE_NOT_EDITABLE: 'Case status does not allow this action',
  JUDGMENT_FAILED: 'Judgment generation failed, please retry later',
  INTERNAL_ERROR: 'Internal server error',
  AI_SERVICE_ERROR: 'AI service error',
  DATABASE_ERROR: 'Database error',
  EXTERNAL_SERVICE_ERROR: 'External service error',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  INVALID_JSON: 'Invalid JSON request body',
  METHOD_NOT_ALLOWED: 'Only GET/HEAD is allowed for file access',
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
  '判決生成中，請稍後再試': 'Judgment is being generated, please try again later',
  '案件已更新': 'Case updated',
  '判決已生成': 'Judgment generated',
  '和好方案已生成': 'Reconciliation plans generated',
  '方案已選擇': 'Plan selected',
  '邀請碼已生成': 'Invite code generated',
  '配對成功': 'Pairing successful',
  '配對已解除': 'Pairing removed',
  '資料更新成功': 'Profile updated successfully',
  '頭像更新成功': 'Avatar updated successfully',
  '個人背景已更新': 'Background profile updated',
  '關係檔案已更新': 'Relationship profile updated',
  '通知已記錄': 'Notification recorded',
  '執行已確認': 'Execution confirmed',
  '打卡成功': 'Check-in successful',
  '已關聯內容': 'Content linked',
  '證據上傳成功': 'Evidence uploaded successfully',
  '證據已刪除': 'Evidence deleted',
  '接口不存在': 'API endpoint not found',
  '僅支持 GET/HEAD 訪問文件': 'Only GET/HEAD is allowed for file access',
  '無效的JSON請求體': 'Invalid JSON request body',
  '驗證碼嘗試過於頻繁，請15分鐘後再試': 'Too many verification attempts, please try again in 15 minutes',
  '重設密碼請求過於頻繁，請稍後再試': 'Too many password reset requests, please try again later',
  '重設密碼嘗試過於頻繁，請15分鐘後再試': 'Too many password reset attempts, please try again in 15 minutes',
  '配對嘗試過於頻繁，請稍後再試': 'Too many pairing attempts, please try again later',
  '操作正在進行中，請稍後再試': 'Operation in progress, please try again later',
  '缺少分布式鎖後端 (Redis)，請聯繫管理員': 'Distributed lock backend (Redis) is unavailable, please contact administrator',
  'Session刷新失敗': 'Session refresh failed',
  'Session更新失敗': 'Session update failed',
};

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
  return byCode[code] ?? fallback ?? code;
}

export function translateBackendMessage(locale: BackendLocale, message: string): string {
  if (locale === 'zh-TW') return message;
  if (message.startsWith('唯一約束違規:')) {
    return message.replace('唯一約束違規:', 'Unique constraint violation:');
  }
  return directEnUSMap[message] ?? message;
}
