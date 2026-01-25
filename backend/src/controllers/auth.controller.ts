import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export class AuthController {
  /**
   * 用戶註冊
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);

      res.status(201).json({
        success: true,
        data: result,
        message: '註冊成功，請查收驗證郵件',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用戶登錄
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);

      res.json({
        success: true,
        data: result,
        message: '登錄成功',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 發送驗證碼
   */
  async sendVerificationCode(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.sendVerificationCode(req.body.email, req.body.type);

      res.json({
        success: true,
        data: {
          expires_in: 300, // 5分鐘
        },
        message: '驗證碼已發送',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 驗證郵件驗證碼
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyEmail(
        req.body.email,
        req.body.code,
        req.body.type || 'register'
      );

      res.json({
        success: true,
        data: {
          verified: result,
        },
        message: '郵箱驗證成功',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 重置密碼
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resetPassword(req.body.email);

      res.json({
        success: true,
        data: {
          expires_in: 300,
        },
        message: '重置密碼郵件已發送',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 確認重置密碼
   */
  async confirmResetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.confirmResetPassword(
        req.body.email,
        req.body.code,
        req.body.new_password
      );

      res.json({
        success: true,
        data: {},
        message: '密碼重置成功',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
