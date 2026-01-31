/**
 * ValidationUtils 測試
 */

import { ValidationUtils } from '../../../src/utils/validation';

describe('ValidationUtils', () => {
  describe('validateStatement', () => {
    it('應接受符合長度的陳述', () => {
      const statement = 'a'.repeat(50);
      expect(ValidationUtils.validateStatement(statement)).toBe(statement);
    });

    it('應拋出空陳述錯誤', () => {
      expect(() => ValidationUtils.validateStatement('')).toThrow();
      expect(() => ValidationUtils.validateStatement('   ')).toThrow();
    });

    it('應拋出過短錯誤', () => {
      expect(() => ValidationUtils.validateStatement('short')).toThrow(/至少50字/);
    });

    it('應拋出過長錯誤', () => {
      expect(() => ValidationUtils.validateStatement('a'.repeat(2001))).toThrow(/不能超過2000字/);
    });

    it('應支持自定義參數', () => {
      const stmt = 'a'.repeat(3); // 少於 minLength 5
      expect(() => ValidationUtils.validateStatement(stmt, '原告陳述', 5, 100)).toThrow(/原告陳述/);
    });
  });

  describe('validateEvidenceUrls', () => {
    it('應接受有效 URL 數組', () => {
      expect(() =>
        ValidationUtils.validateEvidenceUrls(['https://example.com/1.jpg', 'https://example.com/2.jpg'])
      ).not.toThrow();
    });

    it('應拋出非數組錯誤', () => {
      expect(() => ValidationUtils.validateEvidenceUrls(null as any)).toThrow(/必須是數組/);
    });

    it('應拋出超過3個錯誤', () => {
      expect(() =>
        ValidationUtils.validateEvidenceUrls([
          'https://a.com/1.jpg',
          'https://a.com/2.jpg',
          'https://a.com/3.jpg',
          'https://a.com/4.jpg',
        ])
      ).toThrow(/最多只能上傳3張圖片/);
    });

    it('應拋出無效 URL 錯誤', () => {
      expect(() => ValidationUtils.validateEvidenceUrls(['not-a-url'])).toThrow(/格式無效/);
    });

    it('應拋出證據URL格式錯誤（空或非字串）', () => {
      expect(() => ValidationUtils.validateEvidenceUrls([''])).toThrow(/證據URL\[0\]格式錯誤/);
      expect(() => ValidationUtils.validateEvidenceUrls(['https://valid.com/1.jpg', ''])).toThrow(/證據URL\[1\]格式錯誤/);
      expect(() => ValidationUtils.validateEvidenceUrls([123 as unknown as string])).toThrow(/格式錯誤/);
    });
  });

  describe('validateUUID', () => {
    it('應接受有效 UUID', () => {
      expect(() =>
        ValidationUtils.validateUUID('550e8400-e29b-41d4-a716-446655440000')
      ).not.toThrow();
    });

    it('應拒絕無效 UUID', () => {
      expect(() => ValidationUtils.validateUUID('invalid')).toThrow(/格式無效/);
      expect(() => ValidationUtils.validateUUID('')).toThrow();
    });
  });

  describe('validateEmail', () => {
    it('應接受有效郵箱', () => {
      expect(() => ValidationUtils.validateEmail('user@example.com')).not.toThrow();
    });

    it('應拋出無效郵箱錯誤', () => {
      expect(() => ValidationUtils.validateEmail('invalid')).toThrow(/郵箱格式錯誤/);
    });
  });

  describe('validatePassword', () => {
    it('應接受符合要求的密碼', () => {
      expect(() => ValidationUtils.validatePassword('Password123')).not.toThrow();
    });

    it('應拋出空密碼錯誤', () => {
      expect(() => ValidationUtils.validatePassword('')).toThrow();
    });

    it('應拋出長度不足錯誤', () => {
      expect(() => ValidationUtils.validatePassword('Pass1')).toThrow(/至少8位/);
    });

    it('應拋出缺少字母錯誤', () => {
      expect(() => ValidationUtils.validatePassword('12345678')).toThrow(/字母/);
    });

    it('應拋出缺少數字錯誤', () => {
      expect(() => ValidationUtils.validatePassword('PasswordOnly')).toThrow(/數字/);
    });
  });

  describe('validateResponsibilityRatio', () => {
    it('應接受總和為100的比例', () => {
      expect(() =>
        ValidationUtils.validateResponsibilityRatio({ plaintiff: 60, defendant: 40 })
      ).not.toThrow();
    });

    it('應拋出非數字錯誤', () => {
      expect(() =>
        ValidationUtils.validateResponsibilityRatio({ plaintiff: 'a' as any, defendant: 50 })
      ).toThrow(/必須是數字/);
    });

    it('應拋出負數錯誤', () => {
      expect(() =>
        ValidationUtils.validateResponsibilityRatio({ plaintiff: -10, defendant: 110 })
      ).toThrow(/不能為負數/);
    });

    it('應拋出總和不為100錯誤', () => {
      expect(() =>
        ValidationUtils.validateResponsibilityRatio({ plaintiff: 50, defendant: 60 })
      ).toThrow(/總和必須為100/);
    });
  });
});
