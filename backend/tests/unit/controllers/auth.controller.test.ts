/**
 * AuthController 單元測試（mock authService）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../../src/controllers/auth.controller';
import { authService } from '../../../src/services/auth.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRegister: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLogin: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSendVerificationCode: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockVerifyEmail: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockResetPassword: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfirmResetPassword: any = jest.fn();

jest.mock('../../../src/services/auth.service', () => ({
  authService: {
    register: (body: unknown) => mockRegister(body),
    login: (body: unknown) => mockLogin(body),
    sendVerificationCode: (email: string, type: string) => mockSendVerificationCode(email, type),
    verifyEmail: (email: string, code: string, type: string) => mockVerifyEmail(email, code, type),
    resetPassword: (email: string) => mockResetPassword(email),
    confirmResetPassword: (email: string, code: string, newPassword: string) =>
      mockConfirmResetPassword(email, code, newPassword),
  },
}));

describe('AuthController', () => {
  let controller: AuthController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService);
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    next = jest.fn();
  });

  describe('register', () => {
    it('成功應調用 authService.register 並返回 201', async () => {
      const result = { user: { id: 'u1', email: 'a@b.com' }, token: 'jwt' };
      mockRegister.mockResolvedValue(result);
      req.body = { email: 'a@b.com', password: 'Pass1!', nickname: 'U' };

      await controller.register(req as Request, res as Response, next);

      expect(mockRegister).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result,
        message: '註冊成功，請查收驗證郵件',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('authService 拋錯應調用 next(error)', async () => {
      const err = new Error('EMAIL_EXISTS');
      mockRegister.mockRejectedValue(err);
      req.body = { email: 'a@b.com', password: 'Pass1!' };

      await controller.register(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('login', () => {
    it('成功應調用 authService.login 並返回 JSON', async () => {
      const result = { user: { id: 'u1' }, token: 'jwt', expires_in: 604800 };
      mockLogin.mockResolvedValue(result);
      req.body = { email: 'a@b.com', password: 'pass' };

      await controller.login(req as Request, res as Response, next);

      expect(mockLogin).toHaveBeenCalledWith(req.body);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: result,
        message: '登錄成功',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('login 拋錯時應 next(error)', async () => {
      mockLogin.mockRejectedValue(new Error('invalid credentials'));
      req.body = { email: 'a@b.com', password: 'pass' };

      await controller.login(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('sendVerificationCode', () => {
    it('成功應返回 expires_in 300', async () => {
      mockSendVerificationCode.mockResolvedValue(undefined);
      req.body = { email: 'a@b.com', type: 'register' };

      await controller.sendVerificationCode(req as Request, res as Response, next);

      expect(mockSendVerificationCode).toHaveBeenCalledWith('a@b.com', 'register');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { expires_in: 300 },
        message: '驗證碼已發送',
      });
    });

    it('sendVerificationCode 拋錯時應 next(error)', async () => {
      mockSendVerificationCode.mockRejectedValue(new Error('rate limit'));
      req.body = { email: 'a@b.com', type: 'register' };

      await controller.sendVerificationCode(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('verifyEmail', () => {
    it('成功應返回 verified: true', async () => {
      mockVerifyEmail.mockResolvedValue(true);
      req.body = { email: 'a@b.com', code: '123456', type: 'verify_email' };

      await controller.verifyEmail(req as Request, res as Response, next);

      expect(mockVerifyEmail).toHaveBeenCalledWith('a@b.com', '123456', 'verify_email');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { verified: true },
        message: '郵箱驗證成功',
      });
    });

    it('無 type 時應傳入 register', async () => {
      mockVerifyEmail.mockResolvedValue(true);
      req.body = { email: 'a@b.com', code: '123456' };

      await controller.verifyEmail(req as Request, res as Response, next);

      expect(mockVerifyEmail).toHaveBeenCalledWith('a@b.com', '123456', 'register');
    });

    it('verifyEmail 拋錯時應 next(error)', async () => {
      mockVerifyEmail.mockRejectedValue(new Error('invalid code'));
      req.body = { email: 'a@b.com', code: '123456' };

      await controller.verifyEmail(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('resetPassword', () => {
    it('成功應返回 expires_in 300', async () => {
      mockResetPassword.mockResolvedValue(undefined);
      req.body = { email: 'a@b.com' };

      await controller.resetPassword(req as Request, res as Response, next);

      expect(mockResetPassword).toHaveBeenCalledWith('a@b.com');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { expires_in: 300 },
        message: '重置密碼郵件已發送',
      });
    });

    it('resetPassword 拋錯時應 next(error)', async () => {
      mockResetPassword.mockRejectedValue(new Error('user not found'));
      req.body = { email: 'a@b.com' };

      await controller.resetPassword(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('confirmResetPassword', () => {
    it('成功應返回空 data', async () => {
      mockConfirmResetPassword.mockResolvedValue(undefined);
      req.body = { email: 'a@b.com', code: '123456', new_password: 'NewPass1!' };

      await controller.confirmResetPassword(req as Request, res as Response, next);

      expect(mockConfirmResetPassword).toHaveBeenCalledWith('a@b.com', '123456', 'NewPass1!');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {},
        message: '密碼重置成功',
      });
    });

    it('confirmResetPassword 拋錯時應 next(error)', async () => {
      mockConfirmResetPassword.mockRejectedValue(new Error('code expired'));
      req.body = { email: 'a@b.com', code: '123456', new_password: 'NewPass1!' };

      await controller.confirmResetPassword(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
