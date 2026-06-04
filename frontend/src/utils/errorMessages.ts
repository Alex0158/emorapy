/**
 * 錯誤碼到 i18n key 的映射。
 *
 * 這個 helper 是 legacy code-path，輸入仍是後端/shared 層錯誤碼；
 * 可見文案必須經過 i18n catalog，避免語系切換後仍顯示固定中文。
 */

import { t } from '@/utils/i18n';

export const ERROR_MESSAGE_KEYS: Record<string, string> = {
  // 認證錯誤
  UNAUTHORIZED: 'common.unauthorized',
  TOKEN_EXPIRED: 'common.unauthorized',
  INVALID_CREDENTIALS: 'common.invalidCredentials',
  EMAIL_EXISTS: 'errorCode.emailExists',
  EMAIL_NOT_VERIFIED: 'message.emailNotVerified',

  // 驗證錯誤
  VALIDATION_ERROR: 'common.validationError',
  INVALID_EMAIL: 'auth.login.emailInvalid',
  WEAK_PASSWORD: 'errorCode.weakPassword',
  INVALID_CODE: 'errorCode.invalidCode',
  CODE_EXPIRED: 'errorCode.codeExpired',

  // Session錯誤
  SESSION_ID_REQUIRED: 'errorCode.sessionIdRequired',
  INVALID_SESSION_ID: 'errorCode.invalidSessionId',
  SESSION_EXPIRED: 'errorCode.sessionExpired',
  SESSION_COMPLETED: 'interview.error.sessionCompleted',

  // 資源錯誤
  NOT_FOUND: 'common.notFound',
  FORBIDDEN: 'common.forbidden',
  ALREADY_PAIRED: 'errorCode.alreadyPaired',

  // 案件錯誤
  CASE_NOT_READY: 'errorCode.caseNotReady',
  CASE_NOT_EDITABLE: 'errorCode.caseNotEditable',
  JUDGMENT_NOT_FOUND: 'errorCode.analysisNotFound',
  JUDGMENT_PENDING: 'errorCode.analysisPending',

  // 文件錯誤
  FILE_TOO_LARGE: 'common.fileTooLarge',
  INVALID_FILE_TYPE: 'errorCode.invalidFileType',
  TOO_MANY_FILES: 'errorCode.tooManyFiles',

  // 訪談錯誤
  CONCURRENT_REQUEST: 'interview.error.concurrentRequest',
  AI_CALL_FAILED: 'interview.error.aiCallFailed',
  TURN_TOO_FAST: 'interview.error.turnTooFast',
  START_RATE_LIMIT: 'common.rateLimit',
  PROCESSING_NOT_DONE: 'errorCode.processingNotDone',
  PROCESSING_FAILED: 'errorCode.processingFailed',
  MAX_TURNS_REACHED: 'interview.error.maxTurns',

  // 系統錯誤
  INTERNAL_ERROR: 'common.serverError',
  DATABASE_ERROR: 'errorCode.databaseError',
  AI_SERVICE_ERROR: 'common.serviceUnavailable',
  EXTERNAL_SERVICE_ERROR: 'errorCode.externalServiceError',
  NETWORK_ERROR: 'common.networkError',
  RATE_LIMIT_EXCEEDED: 'common.rateLimit',

  // 默認
  UNKNOWN_ERROR: 'common.unknownError',
};

/**
 * 獲取用戶友好的錯誤消息
 */
export function getErrorMessage(code?: string | null, defaultMessage?: string | null): string {
  const normalizedCode = typeof code === 'string' ? code.trim() : '';
  const key = normalizedCode ? ERROR_MESSAGE_KEYS[normalizedCode] : undefined;
  if (key) return t(key);

  const normalizedFallback = typeof defaultMessage === 'string' ? defaultMessage.trim() : '';
  if (normalizedFallback.length > 0) return defaultMessage as string;

  return t('common.unknownError');
}
