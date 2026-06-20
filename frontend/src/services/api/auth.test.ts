/**
 * 認證 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  register,
  login,
  claimSession,
  sendVerificationCode,
  verifyEmail,
  resetPassword,
  confirmResetPassword,
  type RegisterDto,
  type LoginDto,
  type AuthResponse,
} from './auth';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  claimSession: vi.fn(),
  sendVerificationCode: vi.fn(),
  verifyEmail: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  createM1ApiClient: vi.fn(() => ({
    auth: {
      register: mocks.register,
      login: mocks.login,
      claimSession: mocks.claimSession,
      sendVerificationCode: mocks.sendVerificationCode,
      verifyEmail: mocks.verifyEmail,
      resetPassword: mocks.resetPassword,
      confirmResetPassword: mocks.confirmResetPassword,
    },
  })),
}));

vi.mock('@emorapy/api-client', () => ({
  createM1ApiClient: (...args: unknown[]) => mocks.createM1ApiClient(...args),
}));

vi.mock('../request', () => ({
  default: { requestName: 'web-request-adapter' },
}));

const mockAuthResponse: AuthResponse = {
  user: {
    id: 'u1',
    email: 'u@example.com',
    nickname: 'User',
    email_verified: true,
    created_at: new Date().toISOString(),
  },
  token: 'jwt-token',
  expires_in: 3600,
};

describe('auth API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createM1ApiClient.mockReturnValue({
      auth: {
        register: mocks.register,
        login: mocks.login,
        claimSession: mocks.claimSession,
        sendVerificationCode: mocks.sendVerificationCode,
        verifyEmail: mocks.verifyEmail,
        resetPassword: mocks.resetPassword,
        confirmResetPassword: mocks.confirmResetPassword,
      },
    });
  });

  describe('register', () => {
    it('應委派 shared M1 auth register 並返回 AuthResponse', async () => {
      mocks.register.mockResolvedValue(mockAuthResponse);
      const dto: RegisterDto = { email: 'new@example.com', password: 'pass', nickname: 'New' };
      const result = await register(dto);
      expect(mocks.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('shared register 回應缺少 token 時應透傳錯誤', async () => {
      mocks.register.mockRejectedValue(new Error('Invalid auth response from server'));
      await expect(register({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        'Invalid auth response from server',
      );
    });
  });

  describe('login', () => {
    it('應委派 shared M1 auth login 並返回 AuthResponse', async () => {
      mocks.login.mockResolvedValue(mockAuthResponse);
      const dto: LoginDto = { email: 'u@example.com', password: 'pass' };
      const result = await login(dto);
      expect(mocks.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });

    it('shared login 回應缺少 token 時應透傳錯誤', async () => {
      mocks.login.mockRejectedValue(new Error('Invalid auth response from server'));
      await expect(login({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        'Invalid auth response from server',
      );
    });
  });

  describe('claimSession', () => {
    it('應委派 shared M1 auth claimSession 並返回 case_id', async () => {
      mocks.claimSession.mockResolvedValue({ case_id: 'case-1' });

      const result = await claimSession('guest_1234567890');

      expect(mocks.claimSession).toHaveBeenCalledWith('guest_1234567890');
      expect(result).toEqual({ case_id: 'case-1' });
    });

    it('shared claimSession 已正規化缺失 case_id 時應保留 null', async () => {
      mocks.claimSession.mockResolvedValue({ case_id: null });

      const result = await claimSession('guest_1234567890');

      expect(result).toEqual({ case_id: null });
    });
  });

  describe('sendVerificationCode', () => {
    it('應委派 shared M1 auth sendVerificationCode 並傳 email 與 type', async () => {
      mocks.sendVerificationCode.mockResolvedValue(undefined);
      await sendVerificationCode('u@example.com', 'register');
      expect(mocks.sendVerificationCode).toHaveBeenCalledWith('u@example.com', 'register');
    });

    it('支援 reset_password 與 verify_email type', async () => {
      mocks.sendVerificationCode.mockResolvedValue(undefined);
      await sendVerificationCode('u@example.com', 'reset_password');
      expect(mocks.sendVerificationCode).toHaveBeenCalledWith('u@example.com', 'reset_password');
    });
  });

  describe('verifyEmail', () => {
    it('應委派 shared M1 auth verifyEmail 並返回 verified', async () => {
      mocks.verifyEmail.mockResolvedValue(true);
      const result = await verifyEmail('u@example.com', '123456', 'verify_email');
      expect(mocks.verifyEmail).toHaveBeenCalledWith('u@example.com', '123456', 'verify_email');
      expect(result).toBe(true);
    });

    it('預設 type 為 verify_email', async () => {
      mocks.verifyEmail.mockResolvedValue(false);
      const result = await verifyEmail('u@example.com', '000000');
      expect(mocks.verifyEmail).toHaveBeenCalledWith('u@example.com', '000000', 'verify_email');
      expect(result).toBe(false);
    });

    it('shared verifyEmail 回應缺少 verified 時應回退為 false', async () => {
      mocks.verifyEmail.mockResolvedValue(false);
      const result = await verifyEmail('u@example.com', '000000');
      expect(result).toBe(false);
    });
  });

  describe('resetPassword', () => {
    it('應委派 shared M1 auth resetPassword 並傳 email', async () => {
      mocks.resetPassword.mockResolvedValue(undefined);
      await resetPassword('u@example.com');
      expect(mocks.resetPassword).toHaveBeenCalledWith('u@example.com');
    });
  });

  describe('confirmResetPassword', () => {
    it('應委派 shared M1 auth confirmResetPassword', async () => {
      mocks.confirmResetPassword.mockResolvedValue(undefined);
      await confirmResetPassword('u@example.com', '123456', 'newPass123');
      expect(mocks.confirmResetPassword).toHaveBeenCalledWith('u@example.com', '123456', 'newPass123');
    });
  });
});
