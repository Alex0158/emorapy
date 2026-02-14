/**
 * 認證 API 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  register,
  login,
  sendVerificationCode,
  verifyEmail,
  resetPassword,
  confirmResetPassword,
  type RegisterDto,
  type LoginDto,
  type AuthResponse,
} from './auth';

const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
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
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('應 POST /auth/register 並返回 AuthResponse', async () => {
      mockPost.mockResolvedValue({ data: { data: mockAuthResponse } });
      const dto: RegisterDto = { email: 'new@example.com', password: 'pass', nickname: 'New' };
      const result = await register(dto);
      expect(mockPost).toHaveBeenCalledWith('/auth/register', dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('login', () => {
    it('應 POST /auth/login 並返回 AuthResponse', async () => {
      mockPost.mockResolvedValue({ data: { data: mockAuthResponse } });
      const dto: LoginDto = { email: 'u@example.com', password: 'pass' };
      const result = await login(dto);
      expect(mockPost).toHaveBeenCalledWith('/auth/login', dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('sendVerificationCode', () => {
    it('應 POST /auth/send-verification-code 並傳 email 與 type', async () => {
      mockPost.mockResolvedValue({ data: { data: null } });
      await sendVerificationCode('u@example.com', 'register');
      expect(mockPost).toHaveBeenCalledWith('/auth/send-verification-code', {
        email: 'u@example.com',
        type: 'register',
      });
    });

    it('支援 reset_password 與 verify_email type', async () => {
      mockPost.mockResolvedValue({ data: {} });
      await sendVerificationCode('u@example.com', 'reset_password');
      expect(mockPost).toHaveBeenCalledWith('/auth/send-verification-code', {
        email: 'u@example.com',
        type: 'reset_password',
      });
    });
  });

  describe('verifyEmail', () => {
    it('應 POST /auth/verify-email 並返回 verified', async () => {
      mockPost.mockResolvedValue({ data: { data: { verified: true } } });
      const result = await verifyEmail('u@example.com', '123456', 'verify_email');
      expect(mockPost).toHaveBeenCalledWith('/auth/verify-email', {
        email: 'u@example.com',
        code: '123456',
        type: 'verify_email',
      });
      expect(result).toBe(true);
    });

    it('預設 type 為 verify_email', async () => {
      mockPost.mockResolvedValue({ data: { data: { verified: false } } });
      const result = await verifyEmail('u@example.com', '000000');
      expect(mockPost).toHaveBeenCalledWith('/auth/verify-email', {
        email: 'u@example.com',
        code: '000000',
        type: 'verify_email',
      });
      expect(result).toBe(false);
    });
  });

  describe('resetPassword', () => {
    it('應 POST /auth/reset-password 並傳 email', async () => {
      mockPost.mockResolvedValue({ data: {} });
      await resetPassword('u@example.com');
      expect(mockPost).toHaveBeenCalledWith('/auth/reset-password', { email: 'u@example.com' });
    });
  });

  describe('confirmResetPassword', () => {
    it('應 POST /auth/reset-password-confirm 並傳 email, code, new_password', async () => {
      mockPost.mockResolvedValue({ data: {} });
      await confirmResetPassword('u@example.com', '123456', 'newPass123');
      expect(mockPost).toHaveBeenCalledWith('/auth/reset-password-confirm', {
        email: 'u@example.com',
        code: '123456',
        new_password: 'newPass123',
      });
    });
  });
});
