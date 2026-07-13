import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { Errors } from '../utils/errors';

export class AuthController {
  /**
   * 用戶註冊
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body, req.locale);

      res.status(201).json({
        success: true,
        data: result,
        message: '註冊成功',
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
      const delivery = await authService.sendVerificationCode(
        req.body.email,
        req.body.type,
        req.locale
      );

      res.json({
        success: true,
        data: delivery,
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
        req.body.type || 'verify_email'
      );

      res.json({
        success: true,
        data: result,
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
      await authService.resetPassword(req.body.email, req.locale);

      res.status(202).json({
        success: true,
        data: {
          expires_in: 300,
        },
        message: '若該帳戶存在，我們已開始處理密碼重置請求',
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
  /**
   * 關聯快速體驗案件
   */
  async claimSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(Errors.UNAUTHORIZED('需要認證'));
      }

      const { session_id } = req.body;
      const result = await authService.claimSession(userId, session_id);

      res.json({
        success: true,
        data: result,
        message: result.case_id ? '案件已關聯到您的帳號' : '無可關聯的案件',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
