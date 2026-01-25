/**
 * 錯誤處理工具
 */

import { message } from 'antd';
import type { ApiError } from '@/types/common';

/**
 * 處理API錯誤
 */
export const handleApiError = (error: ApiError | Error | unknown): void => {
  let errorMessage = '發生未知錯誤，請稍後再試';

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      errorMessage = error.message;
    } else if ('code' in error && typeof error.code === 'string') {
      // 根據錯誤碼顯示對應的錯誤信息
      const errorCodeMap: Record<string, string> = {
        NETWORK_ERROR: '網絡連接失敗，請檢查網絡連接',
        UNAUTHORIZED: '登錄已過期，請重新登錄',
        FORBIDDEN: '無權限訪問此資源',
        NOT_FOUND: '資源不存在',
        VALIDATION_ERROR: '請求參數錯誤',
        RATE_LIMIT: '請求過於頻繁，請稍後再試',
        SERVER_ERROR: '服務器錯誤，請稍後再試',
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
  message.error('網絡連接失敗，請檢查網絡連接後重試');
};

/**
 * 處理超時錯誤
 */
export const handleTimeoutError = (): void => {
  message.error('請求超時，請稍後再試');
};

