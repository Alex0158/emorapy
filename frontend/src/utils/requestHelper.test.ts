/**
 * 請求輔助函數單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSessionId,
  setSessionId,
  clearSessionId,
  buildQueryString,
  addSessionToParams,
} from './requestHelper';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRemove = vi.fn();
vi.mock('./storage', () => ({
  sessionStorage: {
    get: () => mockGet(),
    set: (id: string) => mockSet(id),
    remove: () => mockRemove(),
  },
}));

describe('requestHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSessionId', () => {
    it('有值時應返回 sessionStorage.get()', () => {
      mockGet.mockReturnValue('s1');
      expect(getSessionId()).toBe('s1');
      expect(mockGet).toHaveBeenCalled();
    });

    it('無值時應返回 null', () => {
      mockGet.mockReturnValue(null);
      expect(getSessionId()).toBeNull();
    });
  });

  describe('setSessionId', () => {
    it('應調用 sessionStorage.set', () => {
      setSessionId('s2');
      expect(mockSet).toHaveBeenCalledWith('s2');
    });
  });

  describe('clearSessionId', () => {
    it('應調用 sessionStorage.remove', () => {
      clearSessionId();
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('buildQueryString', () => {
    it('應將物件轉為查詢字串', () => {
      expect(buildQueryString({ a: '1', b: '2' })).toBe('a=1&b=2');
    });

    it('應跳過 undefined 與 null', () => {
      expect(buildQueryString({ a: '1', b: undefined, c: null })).toBe('a=1');
    });

    it('空物件應返回空字串', () => {
      expect(buildQueryString({})).toBe('');
    });

    it('數值應轉為字串', () => {
      expect(buildQueryString({ page: 1, size: 10 })).toBe('page=1&size=10');
    });
  });

  describe('addSessionToParams', () => {
    it('有 sessionId 時應合併 session_id', () => {
      mockGet.mockReturnValue('s1');
      expect(addSessionToParams({ page: 1 })).toEqual({ page: 1, session_id: 's1' });
    });

    it('無 sessionId 時應返回原 params', () => {
      mockGet.mockReturnValue(null);
      expect(addSessionToParams({ page: 1 })).toEqual({ page: 1 });
    });

    it('無參數時有 sessionId 應返回 { session_id }', () => {
      mockGet.mockReturnValue('s1');
      expect(addSessionToParams()).toEqual({ session_id: 's1' });
    });

    it('無參數且無 sessionId 應返回空物件', () => {
      mockGet.mockReturnValue(null);
      expect(addSessionToParams()).toEqual({});
    });
  });
});
