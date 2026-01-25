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
const { hashPassword, comparePassword } = require('../../../src/utils/password');

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
});

