/**
 * admin-jwt 單元測試
 * F10 管理員 JWT 生成與驗證邊界
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { generateAdminToken, verifyAdminToken, type AdminPayload } from '../../../src/utils/admin-jwt';

const mockEnv = {
  JWT_SECRET: 'test-secret-for-admin',
};
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnv;
  },
}));

describe('utils/admin-jwt', () => {
  const validPayload: AdminPayload = {
    id: 'admin-1',
    email: 'admin@test.com',
    roleKey: 'ops',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ADMIN_JWT_SECRET;
    process.env.NODE_ENV = 'test';
  });

  describe('generateAdminToken', () => {
    it('應生成有效 JWT', () => {
      const token = generateAdminToken(validPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('生成的 token 應可被 verifyAdminToken 正確解析', () => {
      const token = generateAdminToken(validPayload);
      const decoded = verifyAdminToken(token);
      expect(decoded.id).toBe(validPayload.id);
      expect(decoded.email).toBe(validPayload.email);
      expect(decoded.roleKey).toBe(validPayload.roleKey);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('verifyAdminToken', () => {
    it('空字串應拋 UNAUTHORIZED（F10 邊界：無效 token 防禦）', () => {
      expect(() => verifyAdminToken('')).toThrow();
      try {
        verifyAdminToken('');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe('UNAUTHORIZED');
      }
    });

    it('無效格式應拋 UNAUTHORIZED', () => {
      expect(() => verifyAdminToken('not-a-jwt')).toThrow();
      try {
        verifyAdminToken('not-a-jwt');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe('UNAUTHORIZED');
      }
    });

    it('過期 token 應拋 TOKEN_EXPIRED', () => {
      const expiredToken = jwt.sign(
        { ...validPayload, exp: Math.floor(Date.now() / 1000) - 60 },
        mockEnv.JWT_SECRET,
        { algorithm: 'HS256' }
      );
      expect(() => verifyAdminToken(expiredToken)).toThrow();
      try {
        verifyAdminToken(expiredToken);
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe('TOKEN_EXPIRED');
      }
    });

    it('簽名錯誤應拋 UNAUTHORIZED', () => {
      const wrongSecretToken = jwt.sign(validPayload, 'wrong-secret', {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
      expect(() => verifyAdminToken(wrongSecretToken)).toThrow();
      try {
        verifyAdminToken(wrongSecretToken);
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe('UNAUTHORIZED');
      }
    });

    it('有效 token 應返回 payload', () => {
      const token = generateAdminToken(validPayload);
      const decoded = verifyAdminToken(token);
      expect(decoded).toMatchObject({
        id: validPayload.id,
        email: validPayload.email,
        roleKey: validPayload.roleKey,
      });
    });
  });
});
