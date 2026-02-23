/**
 * 本地存儲工具
 */

import { SESSION_STORAGE_KEY } from './constants';
import { logger } from './logger';

const CASE_SESSION_MAP_KEY = 'quick_case_session_map';
const CASE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30天
const CASE_SESSION_MAX_ENTRIES = 50;

type CaseSessionEntry = { sid: string; updatedAt: number };
type CaseSessionRawMap = Record<string, string | CaseSessionEntry>;

const parseCaseSessionMap = (): Record<string, CaseSessionEntry> => {
  try {
    const raw = localStorage.getItem(CASE_SESSION_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CaseSessionRawMap;
    const now = Date.now();
    const normalized: Record<string, CaseSessionEntry> = {};

    Object.entries(parsed).forEach(([caseId, value]) => {
      if (typeof value === 'string') {
        normalized[caseId] = { sid: value, updatedAt: now };
        return;
      }
      if (value && typeof value.sid === 'string') {
        normalized[caseId] = {
          sid: value.sid,
          updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : now,
        };
      }
    });
    return normalized;
  } catch {
    return {};
  }
};

const compactCaseSessionMap = (map: Record<string, CaseSessionEntry>): Record<string, CaseSessionEntry> => {
  const now = Date.now();
  const validEntries = Object.entries(map)
    .filter(([, value]) => value.sid && now - value.updatedAt <= CASE_SESSION_TTL_MS)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, CASE_SESSION_MAX_ENTRIES);
  return Object.fromEntries(validEntries);
};

/**
 * Session ID管理（快速體驗模式）
 */
export const sessionStorage = {
  get: (): string | null => {
    try { return localStorage.getItem(SESSION_STORAGE_KEY); } catch { return null; }
  },

  set: (sessionId: string): void => {
    try { localStorage.setItem(SESSION_STORAGE_KEY, sessionId); } catch { /* noop */ }
  },

  remove: (): void => {
    try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* noop */ }
  },

  exists: (): boolean => {
    try { return !!localStorage.getItem(SESSION_STORAGE_KEY); } catch { return false; }
  },
};

/**
 * 快速體驗案件與 Session 映射（解決一 Session 一 Case 導致的舊案件無法訪問）
 */
export const caseSessionMap = {
  get: (caseId: string): string | null => {
    try {
      const compacted = compactCaseSessionMap(parseCaseSessionMap());
      localStorage.setItem(CASE_SESSION_MAP_KEY, JSON.stringify(compacted));
      return compacted[caseId]?.sid ?? null;
    } catch {
      return null;
    }
  },

  set: (caseId: string, sessionId: string): void => {
    try {
      const map = compactCaseSessionMap(parseCaseSessionMap());
      map[caseId] = { sid: sessionId, updatedAt: Date.now() };
      localStorage.setItem(CASE_SESSION_MAP_KEY, JSON.stringify(compactCaseSessionMap(map)));
    } catch (error) {
      logger.error('Failed to save case-session mapping', error);
    }
  },

  /** 移除單一案件映射（案件不存在或 404 時清理，避免重複請求報錯） */
  remove: (caseId: string): void => {
    try {
      const map = parseCaseSessionMap();
      delete map[caseId];
      localStorage.setItem(CASE_SESSION_MAP_KEY, JSON.stringify(map));
    } catch {
      // ignore
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
    try { localStorage.removeItem(key); } catch { /* noop */ }
  },

  clear: (): void => {
    try { localStorage.clear(); } catch { /* noop */ }
  },
};

