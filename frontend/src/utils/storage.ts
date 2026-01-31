/**
 * 本地存儲工具
 */

import { SESSION_STORAGE_KEY } from './constants';
import { logger } from './logger';

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

