import prisma from '../config/database';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { generateVerificationCode } from '../utils/session';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { emailService } from './email.service';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 分鐘

export interface RegisterDto {
  email: string;
  password: string;
  nickname?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * 用戶註冊
   */
  async register(data: RegisterDto): Promise<{ user: any; token: string }> {
    if (!this.isValidEmail(data.email)) {
      throw Errors.INVALID_EMAIL();
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw Errors.EMAIL_EXISTS();
    }

    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw Errors.WEAK_PASSWORD(passwordValidation.message);
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password_hash: passwordHash,
        nickname: data.nickname,
        email_verified: false,
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        email_verified: true,
        created_at: true,
      },
    });

    this.sendVerificationCode(data.email, 'register').catch(err => {
      logger.error('Failed to send verification email', { email: data.email, error: err });
    });

    const token = generateToken({ id: user.id, email: user.email, token_version: 0 });

    logger.info('User registered', { userId: user.id, email: user.email });

    return { user, token };
  }

  /**
   * 用戶登錄（含帳號鎖定保護）
   */
  async login(data: LoginDto): Promise<{ user: any; token: string; expires_in: number }> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw Errors.INVALID_CREDENTIALS();
    }

    // 檢查帳號是否被鎖定
    if (user.locked_until && user.locked_until > new Date()) {
      const remainingMs = user.locked_until.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw Errors.RATE_LIMIT_EXCEEDED(`帳號已被暫時鎖定，請${remainingMin}分鐘後再試`);
    }

    // 鎖定已到期：先重置失敗計數
    if (user.locked_until && user.locked_until <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { login_failed_attempts: 0, locked_until: null },
      }).catch(() => {});
      user.login_failed_attempts = 0;
    }

    const isValid = await comparePassword(data.password, user.password_hash);
    if (!isValid) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { login_failed_attempts: { increment: 1 } },
        select: { login_failed_attempts: true },
      });

      if (updated.login_failed_attempts >= MAX_LOGIN_ATTEMPTS) {
        await prisma.user.update({
          where: { id: user.id },
          data: { locked_until: new Date(Date.now() + LOCKOUT_DURATION_MS) },
        }).catch(() => {});
        logger.warn('Account locked due to failed attempts', {
          email: data.email,
          attempts: updated.login_failed_attempts,
        });
      }

      throw Errors.INVALID_CREDENTIALS();
    }

    if (!user.is_active) {
      throw Errors.UNAUTHORIZED('帳號未激活');
    }
    if (!user.email_verified) {
      throw Errors.UNAUTHORIZED('請先完成郵箱驗證');
    }

    // 登入成功：重置失敗計數和鎖定狀態
    await prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        login_failed_attempts: 0,
        locked_until: null,
      },
    }).catch(() => {});

    const token = generateToken({
      id: user.id,
      email: user.email,
      token_version: user.token_version,
    });

    logger.info('User logged in', { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        email_verified: user.email_verified,
      },
      token,
      expires_in: 24 * 60 * 60, // 24小時（秒）
    };
  }

  /**
   * 發送驗證碼
   */
  async sendVerificationCode(email: string, type: 'register' | 'reset_password' | 'verify_email'): Promise<void> {
    const recentCode = await prisma.emailVerification.findFirst({
      where: {
        email,
        type,
        created_at: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (recentCode) {
      throw Errors.RATE_LIMIT_EXCEEDED('請稍後再試');
    }

    const code = generateVerificationCode();

    await prisma.emailVerification.create({
      data: {
        email,
        code,
        type,
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await emailService.sendVerificationCode(email, code, type);

    logger.info('Verification code sent', { email, type });
  }

  /**
   * 驗證郵件驗證碼（含失敗次數追蹤，超過 5 次自動作廢）
   */
  async verifyEmail(email: string, code: string, type: 'register' | 'reset_password' | 'verify_email' = 'verify_email'): Promise<boolean> {
    // 找到最新一筆未使用的驗證碼
    const latestVerification = await prisma.emailVerification.findFirst({
      where: { email, type, used: false },
      orderBy: { created_at: 'desc' },
    });

    if (!latestVerification) {
      throw Errors.INVALID_CODE();
    }

    if (latestVerification.expires_at < new Date()) {
      throw Errors.CODE_EXPIRED();
    }

    // 統計該驗證碼建立後的失敗嘗試次數（同 email+type 的錯誤紀錄）
    const failedAttempts = await prisma.emailVerification.count({
      where: {
        email,
        type,
        used: true,
        created_at: { gte: latestVerification.created_at },
        code: { not: latestVerification.code },
      },
    });

    if (failedAttempts >= 5) {
      // 超過 5 次錯誤嘗試，作廢此驗證碼
      await prisma.emailVerification.update({
        where: { id: latestVerification.id },
        data: { used: true },
      });
      logger.warn('Verification code invalidated due to too many failed attempts', { email, type });
      throw Errors.INVALID_CODE();
    }

    // 驗證碼不匹配
    if (latestVerification.code !== code) {
      // 建立一筆「失敗嘗試」紀錄（復用 EmailVerification，標記為 used）
      await prisma.emailVerification.create({
        data: {
          email,
          code,
          type,
          expires_at: latestVerification.expires_at,
          used: true,
        },
      });
      throw Errors.INVALID_CODE();
    }

    // 驗證成功
    await prisma.emailVerification.update({
      where: { id: latestVerification.id },
      data: { used: true },
    });

    await prisma.user.update({
      where: { email },
      data: { email_verified: true },
    });

    logger.info('Email verified', { email });

    return true;
  }

  /**
   * 重置密碼（不洩漏用戶是否存在）
   */
  async resetPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return;
    }

    await this.sendVerificationCode(email, 'reset_password');
  }

  /**
   * 確認重置密碼（成功後使所有現有 Token 失效）
   */
  async confirmResetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const latestVerification = await prisma.emailVerification.findFirst({
      where: { email, type: 'reset_password', used: false },
      orderBy: { created_at: 'desc' },
    });

    if (!latestVerification) {
      throw Errors.INVALID_CODE();
    }

    if (latestVerification.expires_at < new Date()) {
      throw Errors.CODE_EXPIRED();
    }

    // 失敗次數追蹤
    const failedAttempts = await prisma.emailVerification.count({
      where: {
        email,
        type: 'reset_password',
        used: true,
        created_at: { gte: latestVerification.created_at },
        code: { not: latestVerification.code },
      },
    });

    if (failedAttempts >= 5) {
      await prisma.emailVerification.update({
        where: { id: latestVerification.id },
        data: { used: true },
      });
      logger.warn('Reset code invalidated due to too many failed attempts', { email });
      throw Errors.INVALID_CODE();
    }

    if (latestVerification.code !== code) {
      await prisma.emailVerification.create({
        data: {
          email,
          code,
          type: 'reset_password',
          expires_at: latestVerification.expires_at,
          used: true,
        },
      });
      throw Errors.INVALID_CODE();
    }

    const verification = latestVerification;

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw Errors.WEAK_PASSWORD(passwordValidation.message);
    }

    const passwordHash = await hashPassword(newPassword);

    // 更新密碼 + 遞增 token_version（使所有現有 JWT 失效）+ 重置鎖定狀態
    await prisma.user.update({
      where: { email },
      data: {
        password_hash: passwordHash,
        token_version: { increment: 1 },
        login_failed_attempts: 0,
        locked_until: null,
      },
    });

    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { used: true },
    });

    logger.info('Password reset (all sessions invalidated)', { email });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export const authService = new AuthService();
