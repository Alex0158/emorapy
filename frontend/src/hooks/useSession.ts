/**
 * Session相關Hooks（快速體驗模式）
 */

import { useState, useEffect, useCallback } from 'react';
import * as sessionApi from '@/services/api/session';
import { sessionStorage } from '@/utils/storage';
import { message } from 'antd';

/**
 * 使用Session管理
 */
export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 初始化時檢查是否有Session
  useEffect(() => {
    const stored = sessionStorage.get();
    if (stored) {
      setSessionId(stored);
    }
  }, []);

  /**
   * 創建新Session
   */
  const createSession = useCallback(async () => {
    setLoading(true);
    try {
      const session = await sessionApi.createSession();
      sessionStorage.set(session.session_id);
      setSessionId(session.session_id);
      return session.session_id;
    } catch (error: any) {
      message.error('創建Session失敗，請刷新頁面重試');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 獲取或創建Session
   */
  const getOrCreateSession = useCallback(async () => {
    if (sessionId) {
      return sessionId;
    }
    return await createSession();
  }, [sessionId, createSession]);

  /**
   * 清除Session
   */
  const clearSession = useCallback(() => {
    sessionStorage.remove();
    setSessionId(null);
  }, []);

  return {
    sessionId,
    loading,
    createSession,
    getOrCreateSession,
    clearSession,
  };
}

