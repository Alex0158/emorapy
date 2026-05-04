/**
 * 錯誤處理工具
 */

import { toast } from 'sonner';
import type { ApiError } from '@/types/common';
import { t } from '@/utils/i18n';

/**
 * 處理API錯誤
 * F10 約定：message 為空字串或純空白時使用對應 fallback，不顯示空白
 */
export const handleApiError = (error: ApiError | Error | unknown): void => {
  let errorMessage = t('common.unknownError');

  if (error && typeof error === 'object') {
    const rawMsg = 'message' in error ? (error as { message?: unknown }).message : undefined;
    if (typeof rawMsg === 'string' && rawMsg.trim().length > 0) {
      errorMessage = rawMsg;
    } else if ('code' in error && typeof error.code === 'string') {
      // 根據錯誤碼顯示對應的錯誤信息
      const errorCodeMap: Record<string, string> = {
        NETWORK_ERROR: t('common.networkError'),
        UNAUTHORIZED: t('common.unauthorized'),
        TOKEN_EXPIRED: t('common.unauthorized'),
        INVALID_CREDENTIALS: t('common.invalidCredentials'),
        EMAIL_NOT_VERIFIED: t('message.emailNotVerified'),
        EMAIL_EXISTS: t('common.conflict'),
        FORBIDDEN: t('common.forbidden'),
        NOT_FOUND: t('common.notFound'),
        VALIDATION_ERROR: t('common.validationError'),
        INVALID_EMAIL: t('common.validationError'),
        WEAK_PASSWORD: t('common.validationError'),
        INVALID_CODE: t('common.validationError'),
        CODE_EXPIRED: t('common.validationError'),
        ALREADY_PAIRED: t('common.conflict'),
        CASE_NOT_READY: t('common.validationError'),
        CASE_NOT_EDITABLE: t('common.validationError'),
        RATE_LIMIT: t('common.rateLimit'),
        RATE_LIMIT_EXCEEDED: t('common.rateLimit'),
        TURN_TOO_FAST: t('common.rateLimit'),
        START_RATE_LIMIT: t('common.rateLimit'),
        CONCURRENT_REQUEST: t('common.conflict'),
        AI_CALL_FAILED: t('message.judgmentUnavailable'),
        SERVER_ERROR: t('common.serverError'),
        INTERNAL_ERROR: t('common.serverError'),
        DATABASE_ERROR: t('common.serverError'),
        AI_SERVICE_ERROR: t('message.judgmentUnavailable'),
        EXTERNAL_SERVICE_ERROR: t('common.serviceUnavailable'),
        SESSION_COMPLETED: t('interview.error.sessionCompleted'),
        PROCESSING_NOT_DONE: t('common.conflict'),
        PROCESSING_FAILED: t('common.serverError'),
        MAX_TURNS_REACHED: t('interview.error.maxTurns'),
      };

      errorMessage = errorCodeMap[error.code] || errorMessage;
    }
  }

  toast.error(errorMessage);
};

/**
 * 處理表單驗證錯誤
 */
export const handleValidationError = (errors: Record<string, string[]>): void => {
  const firstError = Object.values(errors)[0]?.[0];
  if (firstError) {
    toast.error(firstError);
  }
};

/**
 * 處理網絡錯誤
 */
export const handleNetworkError = (): void => {
  toast.error(t('common.networkError'));
};

/**
 * 處理超時錯誤
 */
export const handleTimeoutError = (): void => {
  toast.error(t('common.timeoutError'));
};

