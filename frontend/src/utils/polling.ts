/**
 * 輪詢工具函數
 */

export interface PollingOptions {
  interval?: number;
  maxAttempts?: number;
  onSuccess?: (data: any) => boolean; // 返回true表示停止輪詢
  onError?: (error: Error) => boolean; // 返回true表示停止輪詢
}

/**
 * 創建輪詢函數
 */
export function createPolling<T>(
  fetchFn: () => Promise<T>,
  options: PollingOptions = {}
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

      // 如果沒有停止條件，繼續輪詢
      if (!isStopped) {
        timeoutId = setTimeout(() => {
          poll();
        }, interval);
      }

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // 檢查錯誤處理是否要求停止
      if (onError && onError(err)) {
        throw err;
      }

      // 繼續輪詢
      if (!isStopped) {
        timeoutId = setTimeout(() => {
          poll();
        }, interval);
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

