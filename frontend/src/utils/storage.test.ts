/**
 * 本地存儲工具單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }));

import { sessionStorage, localStore } from './storage';

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
const mockRemoveItem = vi.fn();
const mockClear = vi.fn();

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
    clear: mockClear,
  });
  vi.clearAllMocks();
});

describe('storage', () => {
  describe('sessionStorage', () => {
    it('get 應返回 localStorage 的值', () => {
      mockGetItem.mockReturnValue('guest_abc123');
      expect(sessionStorage.get()).toBe('guest_abc123');
      mockGetItem.mockReturnValue(null);
      expect(sessionStorage.get()).toBe(null);
    });
    it('set 應調用 localStorage.setItem', () => {
      sessionStorage.set('guest_xyz');
      expect(mockSetItem).toHaveBeenCalledWith(expect.any(String), 'guest_xyz');
    });
    it('remove 應調用 localStorage.removeItem', () => {
      sessionStorage.remove();
      expect(mockRemoveItem).toHaveBeenCalled();
    });
    it('exists 應根據 getItem 結果返回布爾', () => {
      mockGetItem.mockReturnValue('x');
      expect(sessionStorage.exists()).toBe(true);
      mockGetItem.mockReturnValue(null);
      expect(sessionStorage.exists()).toBe(false);
    });
  });

  describe('localStore', () => {
    it('get 應解析 JSON 並返回', () => {
      mockGetItem.mockReturnValue(JSON.stringify({ a: 1 }));
      expect(localStore.get<{ a: number }>('k')).toEqual({ a: 1 });
    });
    it('get 無值應返回 null', () => {
      mockGetItem.mockReturnValue(null);
      expect(localStore.get('k')).toBe(null);
    });
    it('set 應調用 setItem 並 JSON 序列化', () => {
      localStore.set('k', { x: 1 });
      expect(mockSetItem).toHaveBeenCalledWith('k', '{"x":1}');
    });
    it('remove 應調用 removeItem', () => {
      localStore.remove('k');
      expect(mockRemoveItem).toHaveBeenCalledWith('k');
    });
    it('clear 應調用 clear', () => {
      localStore.clear();
      expect(mockClear).toHaveBeenCalled();
    });
  });
});
