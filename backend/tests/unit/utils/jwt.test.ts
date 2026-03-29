/**
 * JWT工具函數測試
 */

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('JWT Utils', () => {
  const originalEnv = process.env;
  const testPayload = { id: 'test-user-id', email: 'test@example.com' };

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost/test',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-test-key',
      JWT_SECRET: 'new-jwt-secret-at-least-32-characters-long',
      JWT_EXPIRES_IN: '24h',
    };
    delete process.env.JWT_SECRET_PREVIOUS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('generateToken', () => {
    it('應該成功生成JWT token', async () => {
      const { generateToken } = await import('../../../src/utils/jwt');
      const token = generateToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT格式：header.payload.signature
    });

    it('應該生成不同的token（即使payload相同）', async () => {
      const { generateToken } = await import('../../../src/utils/jwt');
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
    it('應該成功驗證有效的token', async () => {
      const { generateToken, verifyToken } = await import('../../../src/utils/jwt');
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('應該拒絕無效的token', async () => {
      const { verifyToken } = await import('../../../src/utils/jwt');
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyToken(invalidToken);
      }).toThrow();
    });

    it('空字串應拋錯（防禦性邊界）', async () => {
      const { verifyToken } = await import('../../../src/utils/jwt');
      expect(() => verifyToken('')).toThrow();
    });

    it('undefined 應拋錯（防禦性邊界）', async () => {
      const { verifyToken } = await import('../../../src/utils/jwt');
      expect(() => verifyToken(undefined as unknown as string)).toThrow();
    });

    it('過期 token 應拋 TOKEN_EXPIRED', async () => {
      const { verifyToken } = await import('../../../src/utils/jwt');
      const expiredToken = jwt.sign(
        { ...testPayload, exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET as string,
        { algorithm: 'HS256' },
      );
      expect(() => verifyToken(expiredToken)).toThrow();
      try {
        verifyToken(expiredToken);
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe('TOKEN_EXPIRED');
      }
    });

    it('應該允許舊密鑰簽發的token在過渡期通過驗證', async () => {
      process.env.JWT_SECRET_PREVIOUS = 'old-jwt-secret-at-least-32-characters-long';
      jest.resetModules();
      const { verifyToken } = await import('../../../src/utils/jwt');

      const legacyToken = jwt.sign(testPayload, process.env.JWT_SECRET_PREVIOUS as string, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });

      const decoded = verifyToken(legacyToken);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('移除舊密鑰後，舊token應失效', async () => {
      const oldSecret = 'old-jwt-secret-at-least-32-characters-long';
      const legacyToken = jwt.sign(testPayload, oldSecret, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
      delete process.env.JWT_SECRET_PREVIOUS;
      jest.resetModules();
      const { verifyToken } = await import('../../../src/utils/jwt');

      expect(() => verifyToken(legacyToken)).toThrow();
    });
  });
});

