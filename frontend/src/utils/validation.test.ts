/**
 * 驗證工具單元測試
 */
import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateStatement,
  validateUrl,
  validateInviteCode,
  validateSessionId,
} from './validation';

describe('validation', () => {
  describe('validateEmail', () => {
    it('有效郵箱應返回 true', () => {
      expect(validateEmail('a@b.com')).toBe(true);
      expect(validateEmail('user@example.org')).toBe(true);
    });
    it('無效郵箱應返回 false', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('no-at')).toBe(false);
      expect(validateEmail('@nodomain.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('至少8位且含字母數字應返回 valid: true', () => {
      expect(validatePassword('abc12345')).toEqual({ valid: true });
    });
    it('少於8位應返回 message', () => {
      expect(validatePassword('ab12')).toEqual({ valid: false, message: '密碼長度至少8位' });
    });
    it('無字母應返回 message', () => {
      expect(validatePassword('12345678')).toEqual({ valid: false, message: '密碼必須包含字母' });
    });
    it('無數字應返回 message', () => {
      expect(validatePassword('abcdefgh')).toEqual({ valid: false, message: '密碼必須包含數字' });
    });
  });

  describe('validateStatement', () => {
    it('至少30字應返回 valid: true', () => {
      expect(validateStatement('a'.repeat(30))).toEqual({ valid: true });
    });
    it('少於30字應返回 message', () => {
      expect(validateStatement('short')).toEqual({ valid: false, message: expect.stringContaining('至少') });
    });
    it('超過2000字應返回 message', () => {
      expect(validateStatement('x'.repeat(2001))).toEqual({ valid: false, message: expect.stringContaining('不能超過') });
    });
    it('前後空白應 trim 後驗證', () => {
      expect(validateStatement('  ' + 'a'.repeat(30) + '  ')).toEqual({ valid: true });
    });
  });

  describe('validateUrl', () => {
    it('有效 URL 應返回 true', () => {
      expect(validateUrl('https://example.com')).toBe(true);
    });
    it('無效 URL 應返回 false', () => {
      expect(validateUrl('not-a-url')).toBe(false);
    });
  });

  describe('validateInviteCode', () => {
    it('6位大寫字母數字應返回 true', () => {
      expect(validateInviteCode('ABC123')).toBe(true);
    });
    it('非6位或含小寫/特殊字應返回 false', () => {
      expect(validateInviteCode('abc123')).toBe(false);
      expect(validateInviteCode('AB12')).toBe(false);
      expect(validateInviteCode('ABC12!')).toBe(false);
    });
  });

  describe('validateSessionId', () => {
    it('guest_ 開頭且長度>10 應返回 true', () => {
      expect(validateSessionId('guest_12345678')).toBe(true);
    });
    it('非 guest_ 開頭或長度<=10 應返回 false', () => {
      expect(validateSessionId('guest_123')).toBe(false);
      expect(validateSessionId('other_12345678')).toBe(false);
    });
  });
});
