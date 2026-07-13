/**
 * 自定義應用錯誤類
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 常用錯誤工廠函數
 */
export const Errors = {
  // 認證錯誤
  UNAUTHORIZED: (message = '未認證') => 
    new AppError(401, 'UNAUTHORIZED', message),
  
  FORBIDDEN: (message = '無權限') => 
    new AppError(403, 'FORBIDDEN', message),
  
  TOKEN_EXPIRED: (message = 'Token已過期') => 
    new AppError(401, 'TOKEN_EXPIRED', message),
  
  INVALID_CREDENTIALS: (message = '郵箱或密碼錯誤') => 
    new AppError(401, 'INVALID_CREDENTIALS', message),
  
  // 驗證錯誤
  VALIDATION_ERROR: (message = '驗證失敗', details?: Record<string, any>) => 
    new AppError(400, 'VALIDATION_ERROR', message, details),
  
  INVALID_EMAIL: (message = '郵箱格式錯誤') => 
    new AppError(400, 'INVALID_EMAIL', message),
  
  WEAK_PASSWORD: (message = '密碼強度不足') => 
    new AppError(400, 'WEAK_PASSWORD', message),
  
  INVALID_CODE: (message = '驗證碼錯誤') => 
    new AppError(400, 'INVALID_CODE', message),
  
  CODE_EXPIRED: (message = '驗證碼已過期') => 
    new AppError(400, 'CODE_EXPIRED', message),
  
  SESSION_ID_REQUIRED: (message = 'Session ID是必需的') => 
    new AppError(400, 'SESSION_ID_REQUIRED', message),
  
  INVALID_SESSION_ID: (message = '無效的Session ID格式') => 
    new AppError(400, 'INVALID_SESSION_ID', message),
  
  SESSION_EXPIRED: (message = 'Session已過期或不存在') => 
    new AppError(401, 'SESSION_EXPIRED', message),
  
  // 資源錯誤
  NOT_FOUND: (message = '資源不存在') => 
    new AppError(404, 'NOT_FOUND', message),
  
  EMAIL_EXISTS: (message = '郵箱已存在') => 
    new AppError(409, 'EMAIL_EXISTS', message),

  EMAIL_NOT_VERIFIED: (message = '請先完成郵箱驗證') =>
    new AppError(403, 'EMAIL_NOT_VERIFIED', message),

  EMAIL_DELIVERY_UNAVAILABLE: (message = '郵件服務暫時不可用，請稍後再試') =>
    new AppError(503, 'EMAIL_DELIVERY_UNAVAILABLE', message),

  REGISTRATION_PROOF_INVALID: (message = '註冊驗證已失效，請重新驗證郵箱') =>
    new AppError(400, 'REGISTRATION_PROOF_INVALID', message),

  REGISTRATION_PROOF_EXPIRED: (message = '註冊驗證已過期，請重新驗證郵箱') =>
    new AppError(400, 'REGISTRATION_PROOF_EXPIRED', message),
  
  ALREADY_PAIRED: (message = '已經有配對關係') => 
    new AppError(409, 'ALREADY_PAIRED', message),
  
  CONFLICT: (message = '資源衝突') => 
    new AppError(409, 'CONFLICT', message),
  
  // 業務邏輯錯誤
  CASE_NOT_READY: (message = '案件尚未準備好', details?: Record<string, any>) =>
    new AppError(422, 'CASE_NOT_READY', message, details),
  
  JUDGMENT_EXISTS: (message = '判決已存在') => 
    new AppError(409, 'JUDGMENT_EXISTS', message),
  
  FILE_TOO_LARGE: (message = '文件過大') => 
    new AppError(413, 'FILE_TOO_LARGE', message),
  
  INVALID_FILE_TYPE: (message = '文件類型不支持') => 
    new AppError(400, 'INVALID_FILE_TYPE', message),
  
  TOO_MANY_FILES: (message = '已達到文件數量上限') => 
    new AppError(400, 'TOO_MANY_FILES', message),
  
  CASE_NOT_EDITABLE: (message = '案件狀態不允許此操作') => 
    new AppError(422, 'CASE_NOT_EDITABLE', message),
  
  JUDGMENT_FAILED: (message = '判決生成失敗，請稍後重試') =>
    new AppError(409, 'JUDGMENT_FAILED', message),

  // 系統錯誤
  INTERNAL_ERROR: (message = '服務器內部錯誤') => 
    new AppError(500, 'INTERNAL_ERROR', message),
  
  AI_SERVICE_ERROR: (message = 'AI服務錯誤') => 
    new AppError(503, 'AI_SERVICE_ERROR', message),
  
  DATABASE_ERROR: (message = '數據庫錯誤') => 
    new AppError(500, 'DATABASE_ERROR', message),
  
  EXTERNAL_SERVICE_ERROR: (message = '外部服務錯誤') => 
    new AppError(503, 'EXTERNAL_SERVICE_ERROR', message),
  
  RATE_LIMIT_EXCEEDED: (message = '請求過於頻繁，請稍後再試') => 
    new AppError(429, 'RATE_LIMIT_EXCEEDED', message),

  // v2.0: 訪談系統錯誤
  CONSENT_REQUIRED: (message = '需要心理畫像同意') =>
    new AppError(403, 'CONSENT_REQUIRED', message),

  CONCURRENT_REQUEST: (message = '已有進行中的請求') =>
    new AppError(409, 'CONCURRENT_REQUEST', message),

  AI_CALL_FAILED: (message = 'AI 調用失敗') =>
    new AppError(503, 'AI_CALL_FAILED', message),

  MAX_TURNS_REACHED: (message = '已達最大對話輪數') =>
    new AppError(422, 'MAX_TURNS_REACHED', message),

  TURN_TOO_FAST: (message = '回覆過快，請稍候') =>
    new AppError(429, 'TURN_TOO_FAST', message),

  START_RATE_LIMIT: (message = '開始訪談過於頻繁') =>
    new AppError(429, 'START_RATE_LIMIT', message),

  PROCESSING_NOT_DONE: (message = '處理尚未完成') =>
    new AppError(409, 'PROCESSING_NOT_DONE', message),

  PROCESSING_FAILED: (message = '處理失敗') =>
    new AppError(500, 'PROCESSING_FAILED', message),

  SESSION_COMPLETED: (message = '此訪談已結束，不可繼續') =>
    new AppError(409, 'SESSION_COMPLETED', message),
};
