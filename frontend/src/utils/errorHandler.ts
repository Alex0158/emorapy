/**
 * 錯誤處理工具
 */

import { message } from 'antd';
import type { ApiError } from '@/types/common';
import { t } from '@/utils/i18n';

/**
 * 處理API錯誤
 */
export const handleApiError = (error: ApiError | Error | unknown): void => {
  let errorMessage = t('common.unknownError');

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      errorMessage = error.message;
    } else if ('code' in error && typeof error.code === 'string') {
      // 根據錯誤碼顯示對應的錯誤信息
      const errorCodeMap: Record<string, string> = {
        NETWORK_ERROR: t('common.networkError'),
        UNAUTHORIZED: t('common.unauthorized'),
        TOKEN_EXPIRED: t('common.unauthorized'),
        EMAIL_NOT_VERIFIED: t('message.emailNotVerified'),
        FORBIDDEN: t('common.forbidden'),
        NOT_FOUND: t('common.notFound'),
        VALIDATION_ERROR: t('common.validationError'),
        RATE_LIMIT: t('common.rateLimit'),
        RATE_LIMIT_EXCEEDED: t('common.rateLimit'),
        SERVER_ERROR: t('common.serverError'),
        INTERNAL_ERROR: t('common.serverError'),
        AI_SERVICE_ERROR: t('message.judgmentUnavailable'),
      };

      errorMessage = errorCodeMap[error.code] || errorMessage;
    }
  }

  message.error(errorMessage);
};

/**
 * 處理表單驗證錯誤
 */
export const handleValidationError = (errors: Record<string, string[]>): void => {
  const firstError = Object.values(errors)[0]?.[0];
  if (firstError) {
    message.error(firstError);
  }
};

/**
 * 處理網絡錯誤
 */
export const handleNetworkError = (): void => {
  message.error(t('common.networkError'));
};

/**
 * 處理超時錯誤
 */
export const handleTimeoutError = (): void => {
  message.error(t('common.timeoutError'));
};

