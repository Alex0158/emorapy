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
    it('null 或 undefined 應視為無效不拋錯（F09 邊界：登入/註冊表單防禦）', () => {
      expect(validateEmail(null as unknown as string)).toBe(false);
      expect(validateEmail(undefined as unknown as string)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('至少8位且含字母數字應返回 valid: true', () => {
      expect(validatePassword('abc12345')).toEqual({ valid: true });
    });
    it('空字串應返回 valid: false（F09 邊界：登入/註冊表單防禦）', () => {
      expect(validatePassword('').valid).toBe(false);
    });
    it('null 或 undefined 應視為無效不拋錯（F09 邊界：登入/註冊表單防禦）', () => {
      expect(validatePassword(null as unknown as string).valid).toBe(false);
      expect(validatePassword(undefined as unknown as string).valid).toBe(false);
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
    it('null 或 undefined 應視為空字串不拋錯（防禦邊界：表單傳入異常時不崩潰）', () => {
      expect(validateStatement(null as unknown as string).valid).toBe(false);
      expect(validateStatement(undefined as unknown as string).valid).toBe(false);
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
    it('空字串應返回 false（F01/F05 邊界：evidence URL 等格式驗證）', () => {
      expect(validateUrl('')).toBe(false);
    });
  });

  describe('validateInviteCode', () => {
    it('6位大寫字母數字應返回 true', () => {
      expect(validateInviteCode('ABC123')).toBe(true);
    });
    it('空字串應返回 false（F08 邊界：配對邀請碼格式驗證）', () => {
      expect(validateInviteCode('')).toBe(false);
    });
    it('null 或 undefined 應視為無效不拋錯（F08 邊界：防禦）', () => {
      expect(validateInviteCode(null as unknown as string)).toBe(false);
      expect(validateInviteCode(undefined as unknown as string)).toBe(false);
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
    it('長度剛好 11 字應返回 true（正邊界：guest_ 6 字 + 5 字 = 11 > 10，F01 session 格式護欄）', () => {
      expect(validateSessionId('guest_12345')).toBe(true);
    });
    it('空字串應返回 false（F01/F09 邊界：session 格式驗證）', () => {
      expect(validateSessionId('')).toBe(false);
    });
    it('長度剛好 10 字應返回 false（負邊界：guest_ 6 字 + 4 字 = 10 不滿足 > 10，F01 session 格式護欄）', () => {
      expect(validateSessionId('guest_1234')).toBe(false);
    });
    it('非 guest_ 開頭或長度<=10 應返回 false', () => {
      expect(validateSessionId('guest_123')).toBe(false);
      expect(validateSessionId('other_12345678')).toBe(false);
    });
    it('null 或 undefined 應視為無效不拋錯（F01/F09 邊界：session 防禦）', () => {
      expect(validateSessionId(null as unknown as string)).toBe(false);
      expect(validateSessionId(undefined as unknown as string)).toBe(false);
    });
  });
});
