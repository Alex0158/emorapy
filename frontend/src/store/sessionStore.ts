/**
 * Session狀態管理（快速體驗模式）
 */

import { create } from 'zustand';
import { getErrorMessage } from '@/utils/apiError';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session } from '@/types/session';
import { createSession, refreshSession } from '@/services/api/session';
import { sessionStorage } from '@/utils/storage';

const SESSION_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

let _inflight: { create?: Promise<Session | null>; refresh?: Promise<Session | null> } = {};

interface SessionState {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  createSession: () => Promise<Session | null>;
  refreshSession: (force?: boolean) => Promise<Session | null>;
  setSession: (session: Session | null) => void;
  clearSession: () => void;
  checkSessionExpiry: () => boolean;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: false,
      error: null,

      createSession: async () => {
        if (_inflight.create) return _inflight.create;

        const current = get().session;
        const currentId = sessionStorage.get();
        if (current && currentId && current.session_id === currentId) {
          const expiresAt = new Date(current.expires_at).getTime();
          if (Number.isFinite(expiresAt) && expiresAt - Date.now() > SESSION_EXPIRY_BUFFER_MS) {
            return current;
          }
        }

        set({ isLoading: true, error: null });

        _inflight.create = (async () => {
          try {
            const session = await createSession();
            sessionStorage.set(session.session_id);
            set({ session, isLoading: false });
            return session;
          } catch (error: unknown) {
            const msg = getErrorMessage(error, 'message.createSessionFail');
            set({ error: msg, isLoading: false });
            return null;
          } finally {
            _inflight.create = undefined;
          }
        })();

        return _inflight.create;
      },

      refreshSession: async (force = false) => {
        if (_inflight.refresh) return _inflight.refresh;

        const current = get().session;
        const currentId = sessionStorage.get();
        if (!force && current && currentId && current.session_id === currentId) {
          const expiresAt = new Date(current.expires_at).getTime();
          if (Number.isFinite(expiresAt) && expiresAt - Date.now() > SESSION_EXPIRY_BUFFER_MS) {
            return current;
          }
        }

        _inflight.refresh = (async () => {
          try {
            const session = await refreshSession();
            sessionStorage.set(session.session_id);
            set({ session, error: null });
            return session;
          } catch (error: unknown) {
            const msg = getErrorMessage(error, 'message.refreshSessionFail');
            set({ error: msg });
            return null;
          } finally {
            _inflight.refresh = undefined;
          }
        })();

        return _inflight.refresh;
      },

      setSession: (session) => {
        if (!session) {
          sessionStorage.remove();
          set({ session: null, error: null });
          return;
        }
        sessionStorage.set(session.session_id);
        set({ session, error: null });
      },

      // 檢查Session是否過期
      checkSessionExpiry: (): boolean => {
        const session = get().session;
        if (!session || !session.expires_at) {
          return false;
        }
        
        const expiresAt = new Date(session.expires_at);
        const now = new Date();
        
        // 提前5分鐘認為過期
        return expiresAt.getTime() - now.getTime() <= SESSION_EXPIRY_BUFFER_MS;
      },

      clearSession: () => {
        sessionStorage.remove();
        set({ session: null, error: null });
      },
    }),
    {
      name: 'session-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session }),
    }
  )
);
