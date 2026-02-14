/**
 * 前端重試工具函數
 */

import { logger } from './logger';

/**
 * 延遲函數
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * 帶重試的請求函數
 */
export async function requestWithRetry<T>(
  requestFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = (error: unknown) => {
      // 默認：只對網絡錯誤重試
      const err = error as { code?: string; response?: unknown };
      return err.code === 'NETWORK_ERROR' || !err.response;
    },
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

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

      logger.warn(`請求失敗，${delay}ms後重試 (${attempt + 1}/${maxRetries})`, error);

      await sleep(delay);
    }
  }

  throw lastError || new Error('Unknown error');
}
