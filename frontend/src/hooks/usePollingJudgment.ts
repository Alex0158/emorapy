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
  const mountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !caseId) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 輪詢開始前設 loading
    setLoading(true);

    const polling = createPolling(
      async () => {
        try {
          const result = await judgmentApi.getJudgmentByCaseId(caseId);
          return result;
        } catch (error: unknown) {
          const err = error as { code?: string };
          if (err.code === 'NOT_FOUND' || err.code === 'HTTP_404') {
            return null;
          }
          throw error;
        }
      },
      {
        interval: 5000,
        maxAttempts: 60,
        onSuccess: (data) => {
          if (data) {
            if (mountedRef.current) {
              setJudgment(data);
              setLoading(false);
            }
            onSuccessRef.current?.(data);
            return true;
          }
          return false;
        },
        onError: (error) => {
          if (mountedRef.current) {
            setLoading(false);
          }
          onErrorRef.current?.(error);
          return true;
        },
      }
    );

    pollingRef.current = polling;

    polling.start().catch((error) => {
      onErrorRef.current?.(error);
    });

    return () => {
      if (pollingRef.current) {
        pollingRef.current.stop();
      }
    };
  }, [caseId, enabled]);

  return {
    judgment,
    loading,
  };
}

