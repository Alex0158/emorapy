/**
 * Session相關Hooks（快速體驗模式）
 */

import { useState, useCallback, useRef } from 'react';
import * as sessionApi from '@/services/api/session';
import { sessionStorage } from '@/utils/storage';
import { getErrorMessage } from '@/utils/apiError';
import { message } from 'antd';

/**
 * 使用Session管理
 */
export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(sessionStorage.get);
  const [loading, setLoading] = useState(false);
  const inflightRef = useRef<Promise<string> | null>(null);

  const createSession = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current;

    setLoading(true);
    inflightRef.current = (async () => {
      try {
        const session = await sessionApi.createSession();
        sessionStorage.set(session.session_id);
        setSessionId(session.session_id);
        return session.session_id;
      } catch (error: unknown) {
        message.error(getErrorMessage(error, 'message.sessionCreateFail'));
        throw error;
      } finally {
        setLoading(false);
        inflightRef.current = null;
      }
    })();
    return inflightRef.current;
  }, []);

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

