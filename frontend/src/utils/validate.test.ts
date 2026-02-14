/**
 * 驗證工具單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { validateEmail, validateStatement, validatePassword, validateSessionId } from './validate';

vi.mock('./constants', () => ({
  MIN_STATEMENT_LENGTH: 30,
  MAX_STATEMENT_LENGTH: 2000,
}));

describe('validate', () => {
  describe('validateEmail', () => {
    it('有效郵箱應返回 true', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('a@b.co')).toBe(true);
    });

    it('無效郵箱應返回 false', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('a@')).toBe(false);
      expect(validateEmail('@b.com')).toBe(false);
    });
  });

  describe('validateStatement', () => {
    it('長度在 min～max 之間應返回 valid: true', () => {
      const s = 'a'.repeat(30);
      expect(validateStatement(s)).toEqual({ valid: true });
      expect(validateStatement('  ' + s + '  ')).toEqual({ valid: true });
    });

    it('長度小於 min 應返回 valid: false 與 message', () => {
      const result = validateStatement('短');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('至少需要');
    });

    it('長度大於 max 應返回 valid: false 與 message', () => {
      const result = validateStatement('a'.repeat(2001));
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能超過');
    });

    it('支援自定義 min、max', () => {
      expect(validateStatement('12345', 5, 10)).toEqual({ valid: true });
      expect(validateStatement('12', 5, 10).valid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('至少 8 位且含字母與數字應通過', () => {
      expect(validatePassword('Password1')).toEqual({ valid: true });
      expect(validatePassword('abc12345')).toEqual({ valid: true });
    });

    it('少於 8 位應失敗', () => {
      const result = validatePassword('Abc1234');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8位');
    });

    it('無字母應失敗', () => {
      const result = validatePassword('12345678');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('字母');
    });

    it('無數字應失敗', () => {
      const result = validatePassword('abcdefgh');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('數字');
    });
  });

  describe('validateSessionId', () => {
    it('guest_ 開頭且長度 > 10 應返回 true', () => {
      expect(validateSessionId('guest_12345678901')).toBe(true);
    });

    it('非 guest_ 開頭應返回 false', () => {
      expect(validateSessionId('other_12345678901')).toBe(false);
    });

    it('長度 <= 10 應返回 false', () => {
      expect(validateSessionId('guest_1234')).toBe(false);
    });
  });
});
