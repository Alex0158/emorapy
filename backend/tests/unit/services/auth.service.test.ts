/**
 * AuthService 單元測試（mock Prisma、password、jwt、session、email）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock 函數用 any 避免 Jest 泛型與 mockResolvedValue 的類型衝突
const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();
const mockGenerateToken = jest.fn();
const mockValidatePasswordStrength = jest.fn();
const mockGenerateVerificationCode = jest.fn();
const mockSendVerificationCode = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  emailVerification: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/utils/password', () => ({
  hashPassword: (p: string) => mockHashPassword(p),
  comparePassword: (p: string, h: string) => mockComparePassword(p, h),
  validatePasswordStrength: (p: string) => mockValidatePasswordStrength(p),
}));
jest.mock('../../../src/utils/jwt', () => ({
  generateToken: (p: unknown) => mockGenerateToken(p),
}));
jest.mock('../../../src/utils/session', () => ({
  generateVerificationCode: () => mockGenerateVerificationCode(),
}));
jest.mock('../../../src/services/email.service', () => ({
  emailService: {
    sendVerificationCode: (email: string, code: string, type: string) =>
      mockSendVerificationCode(email, code, type),
  },
}));

import { AuthService } from '../../../src/services/auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService();
  });

  describe('register', () => {
    it('郵箱格式無效應拋出 INVALID_EMAIL', async () => {
      await expect(service.register({
        email: 'not-an-email',
        password: 'ValidPass1!',
      })).rejects.toMatchObject({ code: 'INVALID_EMAIL' });
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('郵箱已存在應拋出 EMAIL_EXISTS', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await expect(service.register({
        email: 'a@b.com',
        password: 'ValidPass1!',
      })).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
    });

    it('密碼強度不足應拋出 WEAK_PASSWORD', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      mockValidatePasswordStrength.mockReturnValue({ valid: false, message: '弱' });

      await expect(service.register({
        email: 'a@b.com',
        password: 'weak',
      })).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    });

    it('註冊成功應返回 user 與 token', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      mockValidatePasswordStrength.mockReturnValue({ valid: true });
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockHashPassword.mockResolvedValue('hashed');
      prismaMock.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        nickname: null,
        email_verified: false,
        created_at: new Date(),
      });
      mockGenerateToken.mockReturnValue('jwt-token');

      const result = await service.register({
        email: 'a@b.com',
        password: 'ValidPass1!',
        nickname: 'User',
      });

      expect(result.user.email).toBe('a@b.com');
      expect(result.token).toBe('jwt-token');
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'a@b.com',
          password_hash: 'hashed',
          nickname: 'User',
          email_verified: false,
        }),
        select: expect.any(Object),
      });
    });

    it('註冊成功但發送驗證郵件失敗時應記錄 logger.error 且仍返回 user 與 token', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      mockValidatePasswordStrength.mockReturnValue({ valid: true });
      (mockHashPassword as jest.Mock).mockResolvedValue('hashed' as never);
      prismaMock.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        nickname: null,
        email_verified: false,
        created_at: new Date(),
      });
      mockGenerateToken.mockReturnValue('jwt-token');
      prismaMock.emailVerification.findFirst.mockResolvedValue(null);
      mockGenerateVerificationCode.mockReturnValue('123456');
      prismaMock.emailVerification.create.mockResolvedValue({});
      (mockSendVerificationCode as jest.Mock).mockRejectedValue(new Error('smtp failed') as never);

      const result = await service.register({
        email: 'a@b.com',
        password: 'ValidPass1!',
        nickname: 'User',
      });

      expect(result.user.email).toBe('a@b.com');
      expect(result.token).toBe('jwt-token');
      await new Promise(r => setImmediate(r));
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send verification email', {
        email: 'a@b.com',
        error: expect.any(Error),
      });
    });
  });

  describe('login', () => {
    it('用戶不存在應拋出 INVALID_CREDENTIALS', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.login({
        email: 'a@b.com',
        password: 'pass',
      })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('密碼錯誤應拋出 INVALID_CREDENTIALS', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password_hash: 'hash',
        is_active: true,
        email_verified: true,
      });
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockComparePassword.mockResolvedValue(false);

      await expect(service.login({
        email: 'a@b.com',
        password: 'wrong',
      })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('帳號未激活應拋出 UNAUTHORIZED', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password_hash: 'hash',
        is_active: false,
        email_verified: true,
      });
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockComparePassword.mockResolvedValue(true);

      await expect(service.login({
        email: 'a@b.com',
        password: 'pass',
      })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: expect.stringContaining('激活') });
    });

    it('未完成郵箱驗證應拋出 EMAIL_NOT_VERIFIED', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password_hash: 'hash',
        is_active: true,
        email_verified: false,
      });
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockComparePassword.mockResolvedValue(true);

      await expect(service.login({
        email: 'a@b.com',
        password: 'pass',
      })).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED', message: expect.stringContaining('郵箱驗證') });
    });

    it('登錄成功應返回 user、token、expires_in', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password_hash: 'hash',
        nickname: 'U',
        avatar_url: null,
        is_active: true,
        email_verified: true,
      });
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockComparePassword.mockResolvedValue(true);
      prismaMock.user.update.mockResolvedValue({});
      mockGenerateToken.mockReturnValue('jwt-token');

      const result = await service.login({
        email: 'a@b.com',
        password: 'pass',
      });

      expect(result.user.email).toBe('a@b.com');
      expect(result.token).toBe('jwt-token');
      expect(result.expires_in).toBe(7 * 24 * 60 * 60);
    });

    it('登錄成功但更新 last_login_at 失敗時仍應返回 user 與 token', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password_hash: 'hash',
        nickname: 'U',
        avatar_url: null,
        is_active: true,
        email_verified: true,
      });
      (mockComparePassword as jest.Mock).mockResolvedValue(true as never);
      prismaMock.user.update.mockRejectedValue(new Error('db update failed'));
      mockGenerateToken.mockReturnValue('jwt-token');

      const result = await service.login({
        email: 'a@b.com',
        password: 'pass',
      });

      expect(result.user.email).toBe('a@b.com');
      expect(result.token).toBe('jwt-token');
    });
  });

  describe('sendVerificationCode', () => {
    it('5 分鐘內已發送應拋出 RATE_LIMIT_EXCEEDED', async () => {
      prismaMock.emailVerification.findFirst.mockResolvedValue({ id: 'v1' });

      await expect(service.sendVerificationCode('a@b.com', 'register'))
        .rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
      expect(mockSendVerificationCode).not.toHaveBeenCalled();
    });

    it('成功應創建驗證碼並發送郵件', async () => {
      prismaMock.emailVerification.findFirst.mockResolvedValue(null);
      mockGenerateVerificationCode.mockReturnValue('123456');
      prismaMock.emailVerification.create.mockResolvedValue({});
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockSendVerificationCode.mockResolvedValue(undefined);

      await service.sendVerificationCode('a@b.com', 'verify_email');

      expect(prismaMock.emailVerification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'a@b.com',
          code: '123456',
          type: 'verify_email',
        }),
      });
      expect(mockSendVerificationCode).toHaveBeenCalledWith('a@b.com', '123456', 'verify_email');
    });
  });

  describe('verifyEmail', () => {
    it('驗證碼無效應拋出 INVALID_CODE', async () => {
      prismaMock.emailVerification.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('a@b.com', '000000', 'verify_email'))
        .rejects.toMatchObject({ code: 'INVALID_CODE' });
    });

    it('驗證碼已過期應拋出 CODE_EXPIRED', async () => {
      prismaMock.emailVerification.findFirst.mockResolvedValue({
        id: 'v1',
        expires_at: new Date(Date.now() - 1000),
        used: false,
      });

      await expect(service.verifyEmail('a@b.com', '123456', 'verify_email'))
        .rejects.toMatchObject({ code: 'CODE_EXPIRED' });
    });

    it('驗證成功應標記已使用並更新用戶', async () => {
      prismaMock.emailVerification.findFirst.mockResolvedValue({
        id: 'v1',
        expires_at: new Date(Date.now() + 60000),
        used: false,
      });
      prismaMock.emailVerification.update.mockResolvedValue({});
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.verifyEmail('a@b.com', '123456', 'verify_email');

      expect(result).toBe(true);
      expect(prismaMock.emailVerification.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { used: true },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
        data: { email_verified: true },
      });
    });
  });

  describe('resetPassword', () => {
    it('用戶不存在應靜默返回（不拋錯）', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('nonexistent@b.com')).resolves.toBeUndefined();
      expect(mockSendVerificationCode).not.toHaveBeenCalled();
    });

    it('用戶存在應發送重置驗證碼', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      prismaMock.emailVerification.findFirst.mockResolvedValue(null);
      mockGenerateVerificationCode.mockReturnValue('654321');
      prismaMock.emailVerification.create.mockResolvedValue({});
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockSendVerificationCode.mockResolvedValue(undefined);

      await service.resetPassword('a@b.com');

      expect(mockSendVerificationCode).toHaveBeenCalledWith('a@b.com', '654321', 'reset_password');
    });
  });

  describe('confirmResetPassword', () => {
    it('驗證碼無效應拋出 INVALID_CODE', async () => {
      prismaMock.emailVerification.findFirst.mockResolvedValue(null);

      await expect(service.confirmResetPassword('a@b.com', '000000', 'NewPass1!'))
        .rejects.toMatchObject({ code: 'INVALID_CODE' });
    });

    it('新密碼強度不足應拋出 WEAK_PASSWORD', async () => {
      prismaMock.emailVerification.findFirst.mockResolvedValue({
        id: 'v1',
        expires_at: new Date(Date.now() + 60000),
        used: false,
      });
      mockValidatePasswordStrength.mockReturnValue({ valid: false, message: '弱' });

      await expect(service.confirmResetPassword('a@b.com', '123456', 'weak'))
        .rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    });

    it('成功應更新密碼並標記驗證碼已使用', async () => {
      prismaMock.emailVerification.findFirst.mockResolvedValue({
        id: 'v1',
        expires_at: new Date(Date.now() + 60000),
        used: false,
      });
      mockValidatePasswordStrength.mockReturnValue({ valid: true });
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockHashPassword.mockResolvedValue('newHash');
      prismaMock.user.update.mockResolvedValue({});
      prismaMock.emailVerification.update.mockResolvedValue({});

      await service.confirmResetPassword('a@b.com', '123456', 'NewPass1!');

      expect(mockHashPassword).toHaveBeenCalledWith('NewPass1!');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
        data: { password_hash: 'newHash' },
      });
      expect(prismaMock.emailVerification.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { used: true },
      });
    });
  });
});
