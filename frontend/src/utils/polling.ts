/**
 * 輪詢工具函數
 */

export interface PollingOptions<T = unknown> {
  interval?: number;
  maxAttempts?: number;
  onSuccess?: (data: T) => boolean; // 返回true表示停止輪詢
  onError?: (error: Error) => boolean; // 返回true表示停止輪詢
}

/**
 * 創建輪詢函數
 */
export function createPolling<T>(
  fetchFn: () => Promise<T>,
  options: PollingOptions<T> = {}
) {
  const {
    interval = 5000,
    maxAttempts = 60, // 最多輪詢60次（5分鐘）
    onSuccess,
    onError,
  } = options;

  let attempts = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isStopped = false;

  const poll = async (): Promise<T> => {
    if (isStopped) {
      throw new Error('Polling stopped');
    }

    if (attempts >= maxAttempts) {
      throw new Error('Max polling attempts reached');
    }

    attempts++;

    try {
      const data = await fetchFn();

      // 檢查是否應該停止輪詢
      if (onSuccess && onSuccess(data)) {
        return data;
      }

      // 如果沒有停止條件，等待後繼續輪詢（start 的 promise 會等待）
      if (!isStopped && attempts < maxAttempts) {
        await new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, interval);
        });
        return poll();
      }

      // 達到 maxAttempts 且 onSuccess 未返回 true 時拋錯
      if (attempts >= maxAttempts) {
        throw new Error('Max polling attempts reached');
      }

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // 檢查錯誤處理是否要求停止
      if (onError && onError(err)) {
        throw err;
      }

      // 繼續輪詢
      if (!isStopped && attempts < maxAttempts) {
        await new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, interval);
        });
        return poll();
      }

      throw err;
    }
  };

  const stop = () => {
    isStopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return {
    start: poll,
    stop,
  };
}

