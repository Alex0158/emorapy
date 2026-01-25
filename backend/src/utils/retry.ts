/**
 * 重試工具函數
 */

import logger from '../config/logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * 延遲函數
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 指數退避重試
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = (error: any) => {
      // 默認：只對網絡錯誤和5xx錯誤重試
      if (error.status >= 400 && error.status < 500) {
        return false; // 4xx錯誤不重試
      }
      return true; // 網絡錯誤和5xx錯誤重試
    },
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 檢查是否應該重試
      if (!shouldRetry(error)) {
        throw error;
      }

      // 最後一次嘗試失敗，拋出錯誤
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // 計算延遲時間（指數退避）
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      logger.warn('Retry attempt', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: error.message,
      });

      await sleep(delay);
    }
  }

  throw lastError || new Error('Unknown error');
}

/**
 * 簡單重試（固定延遲）
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 最後一次嘗試失敗，拋出錯誤
      if (attempt === maxRetries - 1) {
        throw error;
      }

      await sleep(delay);
    }
  }

  throw lastError || new Error('Unknown error');
}

