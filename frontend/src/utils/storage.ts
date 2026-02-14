/**
 * 本地存儲工具
 */

import { SESSION_STORAGE_KEY } from './constants';
import { logger } from './logger';

const CASE_SESSION_MAP_KEY = 'quick_case_session_map';

/**
 * Session ID管理（快速體驗模式）
 */
export const sessionStorage = {
  get: (): string | null => {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  },

  set: (sessionId: string): void => {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  },

  remove: (): void => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  },

  exists: (): boolean => {
    return !!localStorage.getItem(SESSION_STORAGE_KEY);
  },
};

/**
 * 快速體驗案件與 Session 映射（解決一 Session 一 Case 導致的舊案件無法訪問）
 */
export const caseSessionMap = {
  get: (caseId: string): string | null => {
    try {
      const raw = localStorage.getItem(CASE_SESSION_MAP_KEY);
      if (!raw) return null;
      const map = JSON.parse(raw) as Record<string, string>;
      return map[caseId] ?? null;
    } catch {
      return null;
    }
  },

  set: (caseId: string, sessionId: string): void => {
    try {
      const raw = localStorage.getItem(CASE_SESSION_MAP_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[caseId] = sessionId;
      localStorage.setItem(CASE_SESSION_MAP_KEY, JSON.stringify(map));
    } catch (error) {
      logger.error('Failed to save case-session mapping', error);
    }
  },
};

/**
 * 通用localStorage操作
 */
export const localStore = {
  get: <T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      logger.error('Failed to save to localStorage', error);
    }
  },

  remove: (key: string): void => {
    localStorage.removeItem(key);
  },

  clear: (): void => {
    localStorage.clear();
  },
};

