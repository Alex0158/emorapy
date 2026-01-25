/**
 * API調用相關Hooks
 */

import { useState, useCallback } from 'react';
import { message } from 'antd';
import { getErrorMessage, isNetworkError, isAuthError } from '@/utils/apiError';

interface UseApiOptions {
  showError?: boolean;
  showSuccess?: boolean;
  successMessage?: string;
}

/**
 * 通用API調用Hook
 */
export function useApi<T, P extends any[] = any[]>(
  apiFunction: (...args: P) => Promise<T>,
  options: UseApiOptions = {}
) {
  const { showError = true, showSuccess = false, successMessage } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (...args: P) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiFunction(...args);
        setData(result);

        if (showSuccess && successMessage) {
          message.success(successMessage);
        }

        return result;
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(new Error(errorMessage));

        if (showError) {
          // 網絡錯誤和認證錯誤已在request攔截器中處理
          if (!isNetworkError(err) && !isAuthError(err)) {
            message.error(errorMessage);
          }
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, showError, showSuccess, successMessage]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

