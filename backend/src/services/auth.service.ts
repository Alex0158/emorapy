import prisma from '../config/database';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import { generateToken, UserPayload } from '../utils/jwt';
import { generateVerificationCode } from '../utils/session';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { emailService } from './email.service';

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
    // 1. 驗證郵箱格式
    if (!this.isValidEmail(data.email)) {
      throw Errors.INVALID_EMAIL();
    }

    // 2. 檢查郵箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw Errors.EMAIL_EXISTS();
    }

    // 3. 驗證密碼強度
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw Errors.WEAK_PASSWORD(passwordValidation.message);
    }

    // 4. 加密密碼
    const passwordHash = await hashPassword(data.password);

    // 5. 創建用戶
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

    // 6. 發送驗證郵件（異步，不阻塞）
    this.sendVerificationCode(data.email, 'register').catch(err => {
      logger.error('Failed to send verification email', { email: data.email, error: err });
    });

    // 7. 生成Token
    const token = generateToken({ id: user.id, email: user.email });

    logger.info('User registered', { userId: user.id, email: user.email });

    return { user, token };
  }

  /**
   * 用戶登錄
   */
  async login(data: LoginDto): Promise<{ user: any; token: string; expires_in: number }> {
    // 1. 查找用戶
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw Errors.INVALID_CREDENTIALS();
    }

    // 2. 驗證密碼
    const isValid = await comparePassword(data.password, user.password_hash);
    if (!isValid) {
      throw Errors.INVALID_CREDENTIALS();
    }

    // 3. 檢查帳號狀態
    if (!user.is_active) {
      throw Errors.UNAUTHORIZED('帳號未激活');
    }
    // 3.1 必須完成郵箱驗證
    if (!user.email_verified) {
      throw Errors.UNAUTHORIZED('請先完成郵箱驗證');
    }

    // 4. 更新最後登錄時間
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    }).catch(() => {
      // 更新失敗不影響登錄
    });

    // 5. 生成Token
    const token = generateToken({ id: user.id, email: user.email });

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
      expires_in: 7 * 24 * 60 * 60, // 7天（秒）
    };
  }

  /**
   * 發送驗證碼
   */
  async sendVerificationCode(email: string, type: 'register' | 'reset_password' | 'verify_email'): Promise<void> {
    // 1. 檢查發送頻率（每5分鐘一次）
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

    // 2. 生成6位驗證碼
    const code = generateVerificationCode();

    // 3. 保存驗證碼（5分鐘過期）
    await prisma.emailVerification.create({
      data: {
        email,
        code,
        type,
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // 4. 發送郵件
    await emailService.sendVerificationCode(email, code, type);

    logger.info('Verification code sent', { email, type });
  }

  /**
   * 驗證郵件驗證碼
   */
  async verifyEmail(email: string, code: string, type: 'register' | 'reset_password' | 'verify_email' = 'verify_email'): Promise<boolean> {
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        code,
        type,
        used: false,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!verification) {
      throw Errors.INVALID_CODE();
    }

    if (verification.expires_at < new Date()) {
      throw Errors.CODE_EXPIRED();
    }

    // 標記為已使用
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { used: true },
    });

    // 更新用戶郵箱驗證狀態
    await prisma.user.update({
      where: { email },
      data: { email_verified: true },
    });

    logger.info('Email verified', { email });

    return true;
  }

  /**
   * 重置密碼
   */
  async resetPassword(email: string): Promise<void> {
    // 檢查用戶是否存在
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 為了安全，不告訴用戶郵箱是否存在
      return;
    }

    // 發送重置密碼驗證碼
    await this.sendVerificationCode(email, 'reset_password');
  }

  /**
   * 確認重置密碼
   */
  async confirmResetPassword(email: string, code: string, newPassword: string): Promise<void> {
    // 1. 驗證驗證碼
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        code,
        type: 'reset_password',
        used: false,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!verification) {
      throw Errors.INVALID_CODE();
    }

    if (verification.expires_at < new Date()) {
      throw Errors.CODE_EXPIRED();
    }

    // 2. 驗證密碼強度
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw Errors.WEAK_PASSWORD(passwordValidation.message);
    }

    // 3. 更新密碼
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { email },
      data: { password_hash: passwordHash },
    });

    // 4. 標記驗證碼為已使用
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { used: true },
    });

    logger.info('Password reset', { email });
  }

  /**
   * 驗證郵箱格式
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export const authService = new AuthService();
