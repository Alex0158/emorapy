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

    it('回應缺少 token 時應拋錯', async () => {
      mockPost.mockResolvedValue({
        data: { data: { user: mockAuthResponse.user, token: undefined } },
      });
      await expect(register({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        'Invalid auth response from server',
      );
    });

    it('回應缺少 user 時應拋錯', async () => {
      mockPost.mockResolvedValue({
        data: { data: { user: undefined, token: 't' } },
      });
      await expect(register({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        'Invalid auth response from server',
      );
    });

    it('回應 token 為空字串時應拋錯（F09 邊界：空 token 視為無效）', async () => {
      mockPost.mockResolvedValue({
        data: { data: { user: mockAuthResponse.user, token: '' } },
      });
      await expect(register({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        'Invalid auth response from server',
      );
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

    it('回應缺少 token 時應拋錯', async () => {
      mockPost.mockResolvedValue({
        data: { data: { user: mockAuthResponse.user, token: undefined } },
      });
      await expect(login({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        'Invalid auth response from server',
      );
    });

    it('回應缺少 user 時應拋錯', async () => {
      mockPost.mockResolvedValue({
        data: { data: { user: undefined, token: 't' } },
      });
      await expect(login({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        'Invalid auth response from server',
      );
    });

    it('回應 token 為空字串時應拋錯（F09 邊界：空 token 視為無效）', async () => {
      mockPost.mockResolvedValue({
        data: { data: { user: mockAuthResponse.user, token: '' } },
      });
      await expect(login({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        'Invalid auth response from server',
      );
    });
  });

  describe('claimSession', () => {
    it('應 POST /auth/claim-session 並返回 case_id', async () => {
      mockPost.mockResolvedValue({ data: { data: { case_id: 'case-1' } } });

      const result = await claimSession('guest_1234567890');

      expect(mockPost).toHaveBeenCalledWith('/auth/claim-session', {
        session_id: 'guest_1234567890',
      });
      expect(result).toEqual({ case_id: 'case-1' });
    });

    it('缺少 data 時應回退為 { case_id: null }', async () => {
      mockPost.mockResolvedValue({ data: {} });

      const result = await claimSession('guest_1234567890');

      expect(result).toEqual({ case_id: null });
    });

    it('data 為 { case_id: null } 時應正確返回（F01/F09 claim-session 邊界）', async () => {
      mockPost.mockResolvedValue({ data: { data: { case_id: null } } });

      const result = await claimSession('guest_1234567890');

      expect(result).toEqual({ case_id: null });
    });

    it('data 為 { case_id: undefined } 時應正規化為 { case_id: null }（F01/F09 邊界：API 回傳不完整時防禦）', async () => {
      mockPost.mockResolvedValue({ data: { data: { case_id: undefined } } });

      const result = await claimSession('guest_1234567890');

      expect(result).toEqual({ case_id: null });
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

    it('回應缺少 verified 時應回退為 false', async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });
      const result = await verifyEmail('u@example.com', '000000');
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
