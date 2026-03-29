/**
 * URL 工具單元測試
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildQueryString, parseQueryString, getQueryParams, updateQueryParams, removeQueryParams } from './url';

describe('url', () => {
  describe('buildQueryString', () => {
    it('應將對象轉為查詢字串', () => {
      expect(buildQueryString({ a: '1', b: '2' })).toBe('a=1&b=2');
    });
    it('應跳過 undefined、null、空字串', () => {
      expect(buildQueryString({ a: '1', b: undefined, c: null, d: '' })).toBe('a=1');
    });
    it('空對象應返回空字串', () => {
      expect(buildQueryString({})).toBe('');
    });
  });

  describe('parseQueryString', () => {
    it('應解析查詢字串為對象', () => {
      expect(parseQueryString('a=1&b=2')).toEqual({ a: '1', b: '2' });
    });
    it('空字串應返回空對象', () => {
      expect(parseQueryString('')).toEqual({});
    });
    it('? 前綴應正確解析', () => {
      expect(parseQueryString('?foo=bar')).toEqual({ foo: 'bar' });
    });
  });

  describe('getQueryParams', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { search: '?x=1&y=2', pathname: '/path' },
        writable: true,
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });
    it('應從 window.location.search 解析查詢參數', () => {
      expect(getQueryParams()).toEqual({ x: '1', y: '2' });
    });
  });

  describe('updateQueryParams', () => {
    const replaceState = vi.fn();
    const pushState = vi.fn();
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { search: '?a=1', pathname: '/page' },
        writable: true,
      });
      window.history.replaceState = replaceState;
      window.history.pushState = pushState;
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it('replace=false 時應呼叫 pushState', () => {
      updateQueryParams({ b: '2' }, false);
      expect(pushState).toHaveBeenCalledWith({}, '', expect.stringContaining('b=2'));
    });
    it('replace=true 時應呼叫 replaceState', () => {
      updateQueryParams({ b: '2' }, true);
      expect(replaceState).toHaveBeenCalledWith({}, '', expect.stringContaining('b=2'));
    });
    it('預設 replace 為 false 時應 pushState', () => {
      updateQueryParams({ b: '2' });
      expect(pushState).toHaveBeenCalled();
    });
  });

  describe('removeQueryParams', () => {
    const replaceState = vi.fn();
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { search: '?a=1&b=2&c=3', pathname: '/page' },
        writable: true,
      });
      window.history.replaceState = replaceState;
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it('應移除指定 key 並 replaceState', () => {
      removeQueryParams(['b']);
      const url = replaceState.mock.calls[0][2];
      expect(url).toContain('a=1');
      expect(url).toContain('c=3');
      expect(url).not.toContain('b=');
    });
    it('移除全部後 URL 無查詢字串', () => {
      removeQueryParams(['a', 'b', 'c']);
      expect(replaceState).toHaveBeenCalledWith({}, '', '/page');
    });
  });
});
