/**
 * 判決輪詢Hook
 */

import { useEffect, useRef, useState } from 'react';
import * as judgmentApi from '@/services/api/judgment';
import { createPolling } from '@/utils/polling';
import type { Judgment } from '@/types/judgment';

interface UsePollingJudgmentOptions {
  caseId: string;
  enabled?: boolean;
  onSuccess?: (judgment: Judgment) => void;
  onError?: (error: Error) => void;
}

/**
 * 輪詢判決狀態
 */
export function usePollingJudgment({
  caseId,
  enabled = true,
  onSuccess,
  onError,
}: UsePollingJudgmentOptions) {
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof createPolling> | null>(null);

  useEffect(() => {
    if (!enabled || !caseId) {
      return;
    }

    setLoading(true);

    // 創建輪詢
    const polling = createPolling(
      async () => {
        try {
          const result = await judgmentApi.getJudgmentByCaseId(caseId);
          return result;
        } catch (error: any) {
          // 如果判決尚未生成（404），繼續輪詢
          if (error.code === 'NOT_FOUND' || error.code === 'HTTP_404') {
            return null;
          }
          throw error;
        }
      },
      {
        interval: 5000, // 5秒輪詢一次
        maxAttempts: 60, // 最多5分鐘
        onSuccess: (data) => {
          // 如果獲取到判決，停止輪詢
          if (data) {
            setJudgment(data);
            setLoading(false);
            if (onSuccess) {
              onSuccess(data);
            }
            return true; // 停止輪詢
          }
          return false; // 繼續輪詢
        },
        onError: (error) => {
          setLoading(false);
          if (onError) {
            onError(error);
          }
          return true; // 停止輪詢
        },
      }
    );

    pollingRef.current = polling;

    // 開始輪詢
    polling.start().catch((error) => {
      if (onError) {
        onError(error);
      }
    });

    // 清理函數
    return () => {
      if (pollingRef.current) {
        pollingRef.current.stop();
      }
    };
  }, [caseId, enabled, onSuccess, onError]);

  return {
    judgment,
    loading,
  };
}

