/**
 * 輪詢Hook（統一版本）
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { logger } from '@/utils/logger';

type PollingFunction<T> = () => Promise<T | null>;

interface PollingOptions {
  maxAttempts?: number;        // 最大輪詢次數，默認30次
  maxDuration?: number;         // 最大輪詢時長（毫秒），默認5分鐘
  exponentialBackoff?: boolean; // 是否使用指數退避，默認true
  initialInterval?: number;     // 初始間隔，默認使用baseInterval
  maxInterval?: number;         // 最大間隔，默認30秒
}

interface PollingResult {
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
}

/**
 * 通用輪詢Hook
 * @param fn - 輪詢函數，返回數據或null
 * @param baseInterval - 基礎輪詢間隔（毫秒）
 * @param condition - 停止條件函數，返回true時停止輪詢
 * @param options - 輪詢選項（最大次數、最大時長、指數退避等）
 */
export const usePolling = <T>(
  fn: PollingFunction<T>,
  baseInterval: number,
  condition: (data: T | null) => boolean = (data) => data !== null,
  options: PollingOptions = {}
): PollingResult => {
  const {
    maxAttempts = 30,
    maxDuration = 5 * 60 * 1000, // 5分鐘
    exponentialBackoff = true,
    initialInterval = baseInterval,
    maxInterval = 30 * 1000,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  const conditionRef = useRef(condition);
  const [isPolling, setIsPolling] = useState(false);
  const attemptCountRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const currentIntervalRef = useRef(initialInterval);

  // Update refs if fn or condition changes
  useEffect(() => {
    fnRef.current = fn;
    conditionRef.current = condition;
  }, [fn, condition]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setIsPolling(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (timerRef.current) {
      stopPolling();
    }

    attemptCountRef.current = 0;
    startTimeRef.current = Date.now();
    currentIntervalRef.current = initialInterval;

    const poll = async () => {
      // 檢查是否超過最大次數
      if (attemptCountRef.current >= maxAttempts) {
        stopPolling();
        logger.warn(`輪詢已達到最大次數（${maxAttempts}次）`);
        return;
      }

      // 檢查是否超過最大時長
      if (startTimeRef.current && Date.now() - startTimeRef.current >= maxDuration) {
        stopPolling();
        logger.warn(`輪詢已超過最大時長（${Math.floor(maxDuration / 1000)}秒）`);
        return;
      }

      try {
        attemptCountRef.current++;
        const data = await fnRef.current();
        
        if (conditionRef.current(data)) {
          stopPolling();
          return;
        }

        // 計算下次輪詢間隔（指數退避）
        if (exponentialBackoff) {
          currentIntervalRef.current = Math.min(
            currentIntervalRef.current * 1.5,
            maxInterval
          );
        }

        // 安排下次輪詢
        timerRef.current = setTimeout(poll, currentIntervalRef.current);
      } catch (error) {
        logger.error('Polling error', error);
        
        // 錯誤時也使用指數退避
        if (exponentialBackoff) {
          currentIntervalRef.current = Math.min(
            currentIntervalRef.current * 1.5,
            maxInterval
          );
        }
        
        // 繼續輪詢（除非達到限制）
        if (attemptCountRef.current < maxAttempts) {
          timerRef.current = setTimeout(poll, currentIntervalRef.current);
        } else {
          stopPolling();
        }
      }
    };

    setIsPolling(true);
    poll(); // 立即執行第一次
  }, [baseInterval, maxAttempts, maxDuration, exponentialBackoff, initialInterval, maxInterval, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return { startPolling, stopPolling, isPolling };
};
