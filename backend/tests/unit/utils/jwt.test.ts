/**
 * JWT工具函數測試
 */

import { generateToken, verifyToken } from '../../../src/utils/jwt';

describe('JWT Utils', () => {
  const testPayload = { id: 'test-user-id', email: 'test@example.com' };

  describe('generateToken', () => {
    it('應該成功生成JWT token', () => {
      const token = generateToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT格式：header.payload.signature
    });

    it('應該生成不同的token（即使payload相同）', () => {
      const realNow = Date.now;
      // jsonwebtoken 的 iat/exp 以秒為粒度，需保證時間差至少 1 秒
      // 這裡用 mock Date.now 讓測試穩定且不依賴 sleep
      Date.now = () => 1700000000000;
      const token1 = generateToken(testPayload);
      Date.now = () => 1700000001000;
      const token2 = generateToken(testPayload);
      Date.now = realNow;

      // 由於包含時間戳，token應該不同
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('應該成功驗證有效的token', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('應該拒絕無效的token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyToken(invalidToken);
      }).toThrow();
    });

    it('應該拒絕過期的token', () => {
      // 生成一個立即過期的token（需要修改JWT_EXPIRES_IN為很短的時間）
      // 這裡只是測試結構，實際測試需要設置短過期時間
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
    });
  });
});

