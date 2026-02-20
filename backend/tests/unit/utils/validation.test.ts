import { describe, it, expect } from '@jest/globals';
import { ValidationUtils } from '../../../src/utils/validation';

describe('ValidationUtils', () => {
  describe('validateStatement', () => {
    it('使用默認參數時應通過驗證', () => {
      const value = ValidationUtils.validateStatement('a'.repeat(60));
      expect(value).toBe('a'.repeat(60));
    });

    it('空值應拋出驗證錯誤', () => {
      expect(() => ValidationUtils.validateStatement('' as unknown as string, '原告敘述')).toThrow(
        '原告敘述不能為空'
      );
    });

    it('長度不足應拋出驗證錯誤', () => {
      expect(() => ValidationUtils.validateStatement('too short', '原告敘述', 20, 100)).toThrow(
        '原告敘述長度必須至少20字'
      );
    });

    it('長度超過應拋出驗證錯誤', () => {
      expect(() =>
        ValidationUtils.validateStatement('a'.repeat(101), '原告敘述', 20, 100)
      ).toThrow('原告敘述長度不能超過100字');
    });

    it('有效輸入應回傳 trim 後字串', () => {
      const value = ValidationUtils.validateStatement('   這是一段有效且足夠長的敘述內容   ', '原告敘述', 10, 200);
      expect(value).toBe('這是一段有效且足夠長的敘述內容');
    });
  });

  describe('validateEvidenceUrls', () => {
    it('非陣列應拋出驗證錯誤', () => {
      expect(() => ValidationUtils.validateEvidenceUrls('x' as unknown as string[])).toThrow(
        '證據URL必須是數組'
      );
    });

    it('超過 3 筆應拋出 TOO_MANY_FILES', () => {
      expect(() =>
        ValidationUtils.validateEvidenceUrls([
          'https://a.com/1.jpg',
          'https://a.com/2.jpg',
          'https://a.com/3.jpg',
          'https://a.com/4.jpg',
        ])
      ).toThrow('最多只能上傳3張圖片');
    });

    it('URL 非字串應拋出驗證錯誤', () => {
      expect(() => ValidationUtils.validateEvidenceUrls(['https://a.com/1.jpg', null as unknown as string])).toThrow(
        '證據URL[1]格式錯誤'
      );
    });

    it('URL 格式無效應拋出驗證錯誤', () => {
      expect(() => ValidationUtils.validateEvidenceUrls(['not-url'])).toThrow('證據URL[0]格式無效');
    });

    it('非 HTTPS 應拋出驗證錯誤', () => {
      expect(() => ValidationUtils.validateEvidenceUrls(['http://a.com/1.jpg'])).toThrow(
        '證據URL[0]僅支持 HTTPS'
      );
    });

    it('合法 HTTPS 陣列不應拋錯', () => {
      expect(() =>
        ValidationUtils.validateEvidenceUrls(['https://a.com/1.jpg', 'https://b.com/2.jpg'])
      ).not.toThrow();
    });
  });

  describe('validateUUID', () => {
    it('使用默認 fieldName 時非法 UUID 應提示 ID', () => {
      expect(() => ValidationUtils.validateUUID('bad-uuid')).toThrow('ID格式無效');
    });

    it('合法 UUID 不應拋錯', () => {
      expect(() =>
        ValidationUtils.validateUUID('550e8400-e29b-41d4-a716-446655440000', '案件ID')
      ).not.toThrow();
    });

    it('非法 UUID 應拋出驗證錯誤', () => {
      expect(() => ValidationUtils.validateUUID('bad-uuid', '案件ID')).toThrow('案件ID格式無效');
    });
  });

  describe('validateEmail', () => {
    it('合法 Email 不應拋錯', () => {
      expect(() => ValidationUtils.validateEmail('user@example.com')).not.toThrow();
    });

    it('非法 Email 應拋出 INVALID_EMAIL', () => {
      expect(() => ValidationUtils.validateEmail('invalid-email')).toThrow('郵箱格式錯誤');
    });
  });

  describe('validatePassword', () => {
    it('空密碼應拋出錯誤', () => {
      expect(() => ValidationUtils.validatePassword('')).toThrow('密碼不能為空');
    });

    it('長度不足應拋出錯誤', () => {
      expect(() => ValidationUtils.validatePassword('abc12')).toThrow('密碼長度至少8位');
    });

    it('無字母應拋出錯誤', () => {
      expect(() => ValidationUtils.validatePassword('12345678')).toThrow('密碼必須包含字母');
    });

    it('無數字應拋出錯誤', () => {
      expect(() => ValidationUtils.validatePassword('abcdefgh')).toThrow('密碼必須包含數字');
    });

    it('合法密碼不應拋錯', () => {
      expect(() => ValidationUtils.validatePassword('abc12345')).not.toThrow();
    });
  });

  describe('validateResponsibilityRatio', () => {
    it('非數字應拋出驗證錯誤', () => {
      expect(() =>
        ValidationUtils.validateResponsibilityRatio({ plaintiff: '60' as unknown as number, defendant: 40 })
      ).toThrow('責任分比例必須是數字');
    });

    it('負數比例應拋出驗證錯誤', () => {
      expect(() =>
        ValidationUtils.validateResponsibilityRatio({ plaintiff: -10, defendant: 110 })
      ).toThrow('責任分比例不能為負數');
    });

    it('總和非 100 應拋出驗證錯誤', () => {
      expect(() =>
        ValidationUtils.validateResponsibilityRatio({ plaintiff: 40, defendant: 40 })
      ).toThrow('責任分比例總和必須為100%');
    });

    it('總和為 100 不應拋錯', () => {
      expect(() =>
        ValidationUtils.validateResponsibilityRatio({ plaintiff: 55.5, defendant: 44.5 })
      ).not.toThrow();
    });
  });
});
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

