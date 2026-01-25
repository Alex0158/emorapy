/**
 * Session狀態管理（快速體驗模式）
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session } from '@/types/session';
import { createSession, refreshSession } from '@/services/api/session';
import { sessionStorage } from '@/utils/storage';

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
        // 如果當前Session仍有效（距離過期>5分鐘），直接使用，避免覆蓋導致舊案件權限丟失
        const current = get().session;
        const currentId = sessionStorage.get();
        if (current && currentId && current.session_id === currentId) {
          const expiresAt = new Date(current.expires_at).getTime();
          if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 5 * 60 * 1000) {
            return current;
          }
        }

        // 創建新Session
        set({ isLoading: true, error: null });

        try {
          const session = await createSession();
          sessionStorage.set(session.session_id);
          set({ session, isLoading: false });
          return session;
        } catch (error: any) {
          set({
            error: error.message || '創建Session失敗',
            isLoading: false,
          });
          return null;
        }
      },

      refreshSession: async (force = false) => {
        const current = get().session;
        const currentId = sessionStorage.get();
        if (!force && current && currentId && current.session_id === currentId) {
          const expiresAt = new Date(current.expires_at).getTime();
          // 若距離過期 > 5 分鐘且非強制，直接返回
          if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 5 * 60 * 1000) {
            return current;
          }
        }

        try {
          const session = await refreshSession();
          sessionStorage.set(session.session_id);
          set({ session, error: null });
          return session;
        } catch (error: any) {
          set({ error: error.message || '刷新Session失敗' });
          return null;
        }
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
        return expiresAt.getTime() - now.getTime() <= 5 * 60 * 1000;
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
