/**
 * URL 工具單元測試
 */
import { describe, it, expect } from 'vitest';
import { buildQueryString, parseQueryString } from './url';

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
});
