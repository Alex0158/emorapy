/**
 * 設備檢測工具單元測試
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import {
  getDeviceType,
  getOS,
  getBrowser,
  isTouchDevice,
  isLocalStorageSupported,
  isSessionStorageSupported,
} from './device';

describe('device', () => {
  const origUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: origUserAgent,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  describe('getDeviceType', () => {
    it('width < 768 應返回 mobile', () => {
      Object.defineProperty(window, 'innerWidth', { value: 767, writable: true, configurable: true });
      expect(getDeviceType()).toBe('mobile');
    });

    it('768 <= width < 1024 應返回 tablet', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true, configurable: true });
      expect(getDeviceType()).toBe('tablet');
      Object.defineProperty(window, 'innerWidth', { value: 1023, writable: true, configurable: true });
      expect(getDeviceType()).toBe('tablet');
    });

    it('width >= 1024 應返回 desktop', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
      expect(getDeviceType()).toBe('desktop');
    });
  });

  describe('getOS', () => {
    it('iPhone UA 應返回 ios', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true,
      });
      expect(getOS()).toBe('ios');
    });

    it('Android UA 應返回 android', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10)',
        writable: true,
      });
      expect(getOS()).toBe('android');
    });

    it('Windows UA 應返回 windows', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        writable: true,
      });
      expect(getOS()).toBe('windows');
    });

    it('Mac UA 應返回 macos', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
        writable: true,
      });
      expect(getOS()).toBe('macos');
    });

    it('Linux UA 應返回 linux', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (X11; Linux x86_64)',
        writable: true,
      });
      expect(getOS()).toBe('linux');
    });

    it('未知 UA 應返回 unknown', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'UnknownBot/1.0',
        writable: true,
      });
      expect(getOS()).toBe('unknown');
    });
  });

  describe('getBrowser', () => {
    it('Chrome UA 應返回 chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0 Safari/537.36',
        writable: true,
      });
      expect(getBrowser()).toBe('chrome');
    });

    it('Edge UA 應返回 edge', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/91.0 Edge/91.0',
        writable: true,
      });
      expect(getBrowser()).toBe('edge');
    });

    it('Firefox UA 應返回 firefox', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0',
        writable: true,
      });
      expect(getBrowser()).toBe('firefox');
    });

    it('Safari UA（無 chrome）應返回 safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
        writable: true,
      });
      expect(getBrowser()).toBe('safari');
    });

    it('IE UA 應返回 ie', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko',
        writable: true,
      });
      expect(getBrowser()).toBe('ie');
    });

    it('未知 UA 應返回 unknown', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'CustomBot/1.0',
        writable: true,
      });
      expect(getBrowser()).toBe('unknown');
    });
  });

  describe('isTouchDevice', () => {
    it('應根據 ontouchstart 或 maxTouchPoints 返回布爾值', () => {
      const result = isTouchDevice();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isLocalStorageSupported', () => {
    it('正常環境應返回 true', () => {
      expect(isLocalStorageSupported()).toBe(true);
    });
    it('setItem 拋錯時應返回 false', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('quota exceeded');
      });
      expect(isLocalStorageSupported()).toBe(false);
      setItem.mockRestore();
    });
  });

  describe('isSessionStorageSupported', () => {
    it('正常環境應返回 true', () => {
      expect(isSessionStorageSupported()).toBe(true);
    });
    it('setItem 拋錯時應返回 false', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('access denied');
      });
      expect(isSessionStorageSupported()).toBe(false);
      setItem.mockRestore();
    });
  });
});
