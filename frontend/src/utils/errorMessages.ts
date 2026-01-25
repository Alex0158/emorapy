/**
 * 錯誤消息映射
 */

export const ERROR_MESSAGES: Record<string, string> = {
  // 認證錯誤
  UNAUTHORIZED: '請先登錄',
  TOKEN_EXPIRED: '登錄已過期，請重新登錄',
  INVALID_CREDENTIALS: '郵箱或密碼錯誤',
  EMAIL_EXISTS: '該郵箱已被註冊',
  EMAIL_NOT_VERIFIED: '請先驗證郵箱',

  // 驗證錯誤
  VALIDATION_ERROR: '請檢查輸入內容',
  INVALID_EMAIL: '郵箱格式錯誤',
  WEAK_PASSWORD: '密碼強度不足',
  INVALID_CODE: '驗證碼錯誤',
  CODE_EXPIRED: '驗證碼已過期',

  // Session錯誤
  SESSION_ID_REQUIRED: 'Session ID是必需的',
  INVALID_SESSION_ID: '無效的Session ID',
  SESSION_EXPIRED: 'Session已過期，請重新開始',

  // 資源錯誤
  NOT_FOUND: '資源不存在',
  FORBIDDEN: '無權限訪問此資源',
  ALREADY_PAIRED: '已經有配對關係',

  // 案件錯誤
  CASE_NOT_READY: '案件尚未準備好',
  CASE_NOT_EDITABLE: '案件狀態不允許此操作',
  JUDGMENT_NOT_FOUND: '判決尚未生成',
  JUDGMENT_PENDING: '判決生成中，請稍後再試',

  // 文件錯誤
  FILE_TOO_LARGE: '文件過大',
  INVALID_FILE_TYPE: '不支持的文件類型',
  TOO_MANY_FILES: '已達到文件數量上限',

  // 系統錯誤
  INTERNAL_ERROR: '服務器內部錯誤',
  AI_SERVICE_ERROR: 'AI服務暫時不可用',
  NETWORK_ERROR: '網絡連接失敗',
  RATE_LIMIT_EXCEEDED: '請求過於頻繁，請稍後再試',

  // 默認
  UNKNOWN_ERROR: '發生未知錯誤',
};

/**
 * 獲取用戶友好的錯誤消息
 */
export function getErrorMessage(code: string, defaultMessage?: string): string {
  return ERROR_MESSAGES[code] || defaultMessage || ERROR_MESSAGES.UNKNOWN_ERROR;
}

