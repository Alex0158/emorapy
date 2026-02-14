/**
 * 設備檢測工具單元測試
 */
import { describe, it, expect, afterEach } from 'vitest';
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
  });

  describe('isSessionStorageSupported', () => {
    it('正常環境應返回 true', () => {
      expect(isSessionStorageSupported()).toBe(true);
    });
  });
});
