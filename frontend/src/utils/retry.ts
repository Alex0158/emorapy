/**
 * 前端重試工具函數
 */

import { logger } from './logger';

const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); return; }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
};

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
  signal?: AbortSignal;
}

/**
 * 帶重試的請求函數，支援 AbortSignal 取消
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
      const err = error as { code?: string; response?: unknown };
      return err.code === 'NETWORK_ERROR' || !err.response;
    },
    signal,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }

    try {
      return await requestFn();
    } catch (error: unknown) {
      if (signal?.aborted) {
        throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (!shouldRetry(error)) {
        throw error;
      }

      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      logger.warn(`請求失敗，${delay}ms後重試 (${attempt + 1}/${maxRetries})`, error);

      await sleep(delay, signal);
    }
  }

  throw lastError || new Error('Unknown error');
}
