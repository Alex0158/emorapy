/**
 * 本地存儲工具單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));
vi.mock('@/utils/logger', () => ({ logger: { error: (...args: unknown[]) => mockLoggerError(...args) } }));

import { sessionStorage, localStore, caseSessionMap } from './storage';

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
    it('get 應支援舊 key 並遷移到新 key', () => {
      mockGetItem.mockImplementation((key: string) => (key === 'mbc_session_id' ? 'legacy_sid' : null));
      expect(sessionStorage.get()).toBe('legacy_sid');
      expect(mockSetItem).toHaveBeenCalledWith('cj_session_id', 'legacy_sid');
      expect(mockRemoveItem).toHaveBeenCalledWith('mbc_session_id');
    });
    it('set sessionId 為空時應直接返回不寫入（F01 邊界：與 caseSessionMap 一致，防止無效 session）', () => {
      sessionStorage.set('');
      expect(mockSetItem).not.toHaveBeenCalled();
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
    it('get 當 localStorage 拋錯時應返回 null', () => {
      mockGetItem.mockImplementationOnce(() => {
        throw new Error('storage unavailable');
      });
      expect(sessionStorage.get()).toBe(null);
    });
    it('set 當 setItem 拋錯時不應拋出', () => {
      mockSetItem.mockImplementationOnce(() => {
        throw new Error('quota exceeded');
      });
      expect(() => sessionStorage.set('sid')).not.toThrow();
    });
    it('remove 當 removeItem 拋錯時不應拋出', () => {
      mockRemoveItem.mockImplementationOnce(() => {
        throw new Error('storage error');
      });
      expect(() => sessionStorage.remove()).not.toThrow();
    });
    it('exists 當 getItem 拋錯時應返回 false', () => {
      mockGetItem.mockImplementationOnce(() => {
        throw new Error('access denied');
      });
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

    it('get 遇到壞 JSON 時應返回 null', () => {
      mockGetItem.mockReturnValue('{bad-json');
      expect(localStore.get('k')).toBeNull();
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

    it('set 發生錯誤時應記錄 logger.error', () => {
      mockSetItem.mockImplementationOnce(() => {
        throw new Error('quota exceeded');
      });
      localStore.set('k', { x: 1 });
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  describe('caseSessionMap', () => {
    it('get 在無映射資料時應返回 null', () => {
      mockGetItem.mockReturnValueOnce(null);
      expect(caseSessionMap.get('case-none')).toBeNull();
    });

    it('get 應支援舊格式字串映射並回傳 sid', () => {
      mockGetItem.mockReturnValueOnce(
        JSON.stringify({
          caseA: 'sessionA',
        })
      );
      const sid = caseSessionMap.get('caseA');
      expect(sid).toBe('sessionA');
      expect(mockSetItem).toHaveBeenCalled(); // 會寫回正規化結構
    });

    it('get 遇到壞 JSON 時應返回 null', () => {
      mockGetItem.mockReturnValueOnce('{bad-json');
      expect(caseSessionMap.get('caseX')).toBeNull();
    });

    it('get 在寫回 compacted map 失敗時應返回 null', () => {
      mockGetItem.mockReturnValueOnce(JSON.stringify({ caseA: 'sidA' }));
      mockSetItem.mockImplementationOnce(() => {
        throw new Error('write failed');
      });
      expect(caseSessionMap.get('caseA')).toBeNull();
    });

    it('set caseId 或 sessionId 為空時應直接返回不寫入（F01 邊界：防止無效映射）', () => {
      caseSessionMap.set('', 'sid');
      expect(mockSetItem).not.toHaveBeenCalled();
      caseSessionMap.set('caseA', '');
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('set 應保留新資料並壓縮過期資料', () => {
      const now = Date.now();
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
      const expired = now - 31 * 24 * 60 * 60 * 1000;
      mockGetItem.mockReturnValueOnce(
        JSON.stringify({
          oldCase: { sid: 'oldSid', updatedAt: expired },
          validCase: { sid: 'validSid', updatedAt: now - 1000 },
        })
      );

      caseSessionMap.set('newCase', 'newSid');
      const written = JSON.parse(mockSetItem.mock.calls.at(-1)?.[1] as string);
      expect(written.oldCase).toBeUndefined();
      expect(written.validCase.sid).toBe('validSid');
      expect(written.newCase.sid).toBe('newSid');
      dateNowSpy.mockRestore();
    });

    it('set 應在 updatedAt 非數字時回退為當前時間', () => {
      const now = Date.now();
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
      mockGetItem.mockReturnValueOnce(
        JSON.stringify({
          caseA: { sid: 'sidA', updatedAt: 'bad-value' },
        })
      );
      caseSessionMap.set('caseB', 'sidB');
      const written = JSON.parse(mockSetItem.mock.calls.at(-1)?.[1] as string);
      expect(written.caseA.updatedAt).toBe(now);
      dateNowSpy.mockRestore();
    });

    it('remove 應刪除指定映射', () => {
      mockGetItem.mockReturnValueOnce(
        JSON.stringify({
          caseA: { sid: 'sA', updatedAt: Date.now() },
          caseB: { sid: 'sB', updatedAt: Date.now() },
        })
      );
      caseSessionMap.remove('caseA');
      const written = JSON.parse(mockSetItem.mock.calls.at(-1)?.[1] as string);
      expect(written.caseA).toBeUndefined();
      expect(written.caseB.sid).toBe('sB');
    });

    it('remove 遇到例外時應忽略且不拋錯', () => {
      mockGetItem.mockImplementationOnce(() => {
        throw new Error('read failed');
      });
      expect(() => caseSessionMap.remove('caseA')).not.toThrow();
    });

    it('remove 寫回失敗時應走 catch 且不拋錯', () => {
      mockGetItem.mockReturnValueOnce(
        JSON.stringify({
          caseA: { sid: 'sA', updatedAt: Date.now() },
        })
      );
      mockSetItem.mockImplementationOnce(() => {
        throw new Error('write failed');
      });
      expect(() => caseSessionMap.remove('caseA')).not.toThrow();
    });

    it('replaceSession 應批量替換命中的舊 session', () => {
      const now = Date.now();
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
      mockGetItem.mockReturnValueOnce(
        JSON.stringify({
          caseA: { sid: 'sid-old', updatedAt: now - 1000 },
          caseB: { sid: 'sid-keep', updatedAt: now - 2000 },
          caseC: { sid: 'sid-old', updatedAt: now - 3000 },
        })
      );

      caseSessionMap.replaceSession('sid-old', 'sid-new');

      const written = JSON.parse(mockSetItem.mock.calls.at(-1)?.[1] as string);
      expect(written.caseA.sid).toBe('sid-new');
      expect(written.caseC.sid).toBe('sid-new');
      expect(written.caseB.sid).toBe('sid-keep');
      expect(written.caseA.updatedAt).toBe(now);
      dateNowSpy.mockRestore();
    });

    it('replaceSession 未命中時不應寫回', () => {
      mockGetItem.mockReturnValueOnce(
        JSON.stringify({
          caseA: { sid: 'sid-a', updatedAt: Date.now() },
        })
      );

      caseSessionMap.replaceSession('sid-missing', 'sid-new');

      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('replaceSession oldSessionId 或 newSessionId 為空時應直接返回不寫入（F01 邊界）', () => {
      mockGetItem.mockReturnValueOnce(JSON.stringify({ caseA: { sid: 's1', updatedAt: Date.now() } }));
      caseSessionMap.replaceSession('', 'sid-new');
      expect(mockSetItem).not.toHaveBeenCalled();

      mockGetItem.mockReturnValueOnce(JSON.stringify({ caseA: { sid: 's1', updatedAt: Date.now() } }));
      caseSessionMap.replaceSession('s1', '');
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('replaceSession oldSessionId 等於 newSessionId 時應直接返回不寫入（F01 邊界：避免冗餘寫入）', () => {
      mockGetItem.mockReturnValueOnce(JSON.stringify({ caseA: { sid: 'sid-same', updatedAt: Date.now() } }));
      caseSessionMap.replaceSession('sid-same', 'sid-same');
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('replaceSession 寫回失敗時應走 catch 且不拋錯', () => {
      mockGetItem.mockReturnValueOnce(
        JSON.stringify({
          caseA: { sid: 'sid-old', updatedAt: Date.now() },
        })
      );
      mockSetItem.mockImplementationOnce(() => {
        throw new Error('write failed');
      });
      expect(() => caseSessionMap.replaceSession('sid-old', 'sid-new')).not.toThrow();
    });

    it('set 發生錯誤時應記錄 logger.error', () => {
      mockSetItem.mockImplementationOnce(() => {
        throw new Error('write fail');
      });
      caseSessionMap.set('caseE', 'sidE');
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('get 當 entry 的 sid 為空字串時應過濾並返回 null（F01 邊界：compact 過濾無效 sid）', () => {
      const now = Date.now();
      mockGetItem.mockReturnValue(
        JSON.stringify({
          caseEmpty: { sid: '', updatedAt: now },
        })
      );
      expect(caseSessionMap.get('caseEmpty')).toBeNull();
    });

  });
});
