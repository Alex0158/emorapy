/**
 * 驗證工具函數測試
 */

import { isValidEmail } from '../../../src/utils/helpers';
jest.mock('bcrypt', () => ({
  __esModule: true,
  default: { hash: jest.fn(), compare: jest.fn() },
  hash: jest.fn(),
  compare: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validatePasswordStrength } = require('../../../src/utils/password');

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    it('應該接受有效的郵箱地址', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
        'user123@example-domain.com',
      ];

      validEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('應該拒絕無效的郵箱地址', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@example',
        'user name@example.com',
        '',
      ];

      invalidEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePasswordStrength', () => {
    it('應該接受符合要求的密碼', () => {
      const validPasswords = [
        'Password123',
        'MyP@ssw0rd',
        'Secure123!',
        'Test123456',
      ];

      validPasswords.forEach((password) => {
        const result = validatePasswordStrength(password);
        expect(result.valid).toBe(true);
      });
    });

    it('應該拒絕太短的密碼', () => {
      const shortPassword = 'Pass1';
      const result = validatePasswordStrength(shortPassword);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('密碼長度至少8位');
    });

    it('應該拒絕沒有數字的密碼', () => {
      const noNumberPassword = 'SecurePassword';
      const result = validatePasswordStrength(noNumberPassword);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('數字');
    });

    it('應該拒絕沒有字母的密碼', () => {
      const noLetterPassword = '11111111';
      const result = validatePasswordStrength(noLetterPassword);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('字母');
    });

    it('應該拒絕常見弱密碼', () => {
      const weakPasswords = ['password', '12345678', 'qwerty', 'abc123'];

      weakPasswords.forEach((password) => {
        const result = validatePasswordStrength(password);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('簡單');
      });
    });
  });
});

