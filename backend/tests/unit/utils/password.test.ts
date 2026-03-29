/**
 * 密碼工具函數測試
 */

let hashCounter = 0;
jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async (password: string) => `hashed:${password}:${++hashCounter}`),
    compare: jest.fn(async (password: string, hash: string) => hash.startsWith(`hashed:${password}:`)),
  },
  hash: jest.fn(async (password: string) => `hashed:${password}:${++hashCounter}`),
  compare: jest.fn(async (password: string, hash: string) => hash.startsWith(`hashed:${password}:`)),
}));

// 需在 mock 後再載入，避免測試環境因原生 bcrypt 依賴導致失敗
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { hashPassword, comparePassword, validatePasswordStrength } = require('../../../src/utils/password');

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('應該成功加密密碼', async () => {
      const password = 'testPassword123';
      const hashed = await hashPassword(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(0);
    });

    it('相同密碼應該生成不同的哈希值（因為salt）', async () => {
      const password = 'testPassword123';
      const hashed1 = await hashPassword(password);
      const hashed2 = await hashPassword(password);

      expect(hashed1).not.toBe(hashed2);
    });
  });

  describe('comparePassword', () => {
    it('應該正確驗證正確的密碼', async () => {
      const password = 'testPassword123';
      const hashed = await hashPassword(password);

      const isValid = await comparePassword(password, hashed);
      expect(isValid).toBe(true);
    });

    it('應該拒絕錯誤的密碼', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hashed = await hashPassword(password);

      const isValid = await comparePassword(wrongPassword, hashed);
      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('應接受符合強度的密碼', () => {
      expect(validatePasswordStrength('Password123')).toEqual({ valid: true });
    });

    it('應拒絕常見弱密碼', () => {
      expect(validatePasswordStrength('password')).toEqual({ valid: false, message: expect.stringContaining('過於簡單') });
      expect(validatePasswordStrength('12345678')).toEqual({ valid: false, message: expect.stringContaining('過於簡單') });
    });

    it('應拒絕長度不足 8 位', () => {
      expect(validatePasswordStrength('Pass1')).toEqual({ valid: false, message: expect.stringContaining('至少8位') });
    });

    it('應拒絕超過 128 位', () => {
      expect(validatePasswordStrength('a'.repeat(129))).toEqual({ valid: false, message: expect.stringContaining('不能超過128位') });
    });

    it('應拒絕不含字母', () => {
      expect(validatePasswordStrength('87654321')).toEqual({ valid: false, message: expect.stringContaining('字母') });
    });

    it('應拒絕不含數字', () => {
      expect(validatePasswordStrength('PasswordOnly')).toEqual({ valid: false, message: expect.stringContaining('數字') });
    });

    it('剛好 8 位且含字母數字應通過', () => {
      expect(validatePasswordStrength('Pass1234')).toEqual({ valid: true });
    });

    it('剛好 128 位應通過', () => {
      const pwd = 'A'.repeat(127) + '1';
      expect(validatePasswordStrength(pwd)).toEqual({ valid: true });
    });
  });
});

