import prisma from '../config/database';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { Errors } from '../utils/errors';
import logger from '../config/logger';
import { buildClaimableSessionCaseWhere, isClaimableSessionCase } from '../utils/case-classifier';
import { buildSessionBoundQuickPairingWhere } from '../utils/pairing-invariant';
import type { BackendLocale } from '../i18n';
import type {
  LoginDto,
  RegisterDto,
  VerificationCodeDeliveryResult,
} from '../types/auth.types';
import {
  authChallengeService,
  getVerificationCodeDeliveryResult,
  type AuthChallengeService,
} from './auth-challenge.service';
import { normalizeAuthEmail } from '../utils/auth-email';
import type {
  EmailVerificationResult,
  RegistrationVerificationResult,
} from '../types/auth.types';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 分鐘

export class AuthService {
  constructor(
    private readonly challengeService: Pick<
      AuthChallengeService,
      | 'issue'
      | 'verifyRegistrationCode'
      | 'verifyExistingEmail'
      | 'consumeRegistrationProof'
      | 'verifyAndConsumeResetCode'
    > = authChallengeService
  ) {}

  /**
   * 用戶註冊
   */
  async register(data: RegisterDto, _locale: BackendLocale = 'zh-TW') {
    const email = normalizeAuthEmail(data.email);
    if (!this.isValidEmail(email)) {
      throw Errors.INVALID_EMAIL();
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw Errors.EMAIL_EXISTS();
    }

    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw Errors.WEAK_PASSWORD(passwordValidation.message);
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.$transaction(async (tx) => {
      await this.challengeService.consumeRegistrationProof(tx, email, data.registration_proof);
      return tx.user.create({
        data: {
          email,
          password_hash: passwordHash,
          nickname: data.nickname,
          email_verified: true,
        },
        select: {
          id: true,
          email: true,
          nickname: true,
          email_verified: true,
          created_at: true,
        },
      });
    }, { isolationLevel: 'Serializable' });

    const token = generateToken({ id: user.id, email: user.email, token_version: 0 });

    logger.info('User registered', { userId: user.id });

    return { user, token };
  }

  /**
   * 用戶登錄（含帳號鎖定保護）
   */
  async login(data: LoginDto) {
    const email = normalizeAuthEmail(data.email);
    const user = await prisma.user.findUnique({
      where: { email },
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
      }).catch((e) => { logger.warn('Failed to reset expired lockout', { userId: user.id, error: e }); });
      user.login_failed_attempts = 0;
    }

    const isValid = await comparePassword(data.password, user.password_hash);
    if (!isValid) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          login_failed_attempts: { increment: 1 },
          ...(user.login_failed_attempts + 1 >= MAX_LOGIN_ATTEMPTS
            ? { locked_until: new Date(Date.now() + LOCKOUT_DURATION_MS) }
            : {}),
        },
        select: { login_failed_attempts: true },
      });

      if (updated.login_failed_attempts >= MAX_LOGIN_ATTEMPTS) {
        logger.warn('Account locked due to failed attempts', {
          attempts: updated.login_failed_attempts,
        });
      }

      throw Errors.INVALID_CREDENTIALS();
    }

    if (!user.is_active) {
      throw Errors.UNAUTHORIZED('帳號未激活');
    }
    if (!user.email_verified) {
      throw Errors.EMAIL_NOT_VERIFIED();
    }

    // 登入成功：重置失敗計數和鎖定狀態
    await prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        login_failed_attempts: 0,
        locked_until: null,
      },
    }).catch((e) => { logger.warn('Failed to update login success state', { userId: user.id, error: e }); });

    const token = generateToken({
      id: user.id,
      email: user.email,
      token_version: user.token_version,
    });

    logger.info('User logged in', { userId: user.id });

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
  async sendVerificationCode(
    email: string,
    type: 'register' | 'reset_password' | 'verify_email',
    locale: BackendLocale = 'zh-TW'
  ): Promise<VerificationCodeDeliveryResult> {
    const normalizedEmail = normalizeAuthEmail(email);
    if (type === 'reset_password') {
      throw Errors.VALIDATION_ERROR('密碼重置驗證碼只能透過密碼重置流程申請');
    }
    if (type === 'register') {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingUser) throw Errors.EMAIL_EXISTS();
    } else {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email_verified: true, is_active: true },
      });
      if (!user || !user.is_active || user.email_verified) {
        return getVerificationCodeDeliveryResult();
      }
    }

    return this.challengeService.issue(normalizedEmail, type, locale);
  }

  /**
   * 驗證郵件驗證碼（含失敗次數追蹤，超過 5 次自動作廢）
   */
  async verifyEmail(
    email: string,
    code: string,
    type: 'register' | 'reset_password' | 'verify_email' = 'verify_email'
  ): Promise<RegistrationVerificationResult | EmailVerificationResult> {
    if (type === 'reset_password') {
      throw Errors.VALIDATION_ERROR('密碼重置驗證碼必須在確認重置時驗證');
    }
    return type === 'register'
      ? this.challengeService.verifyRegistrationCode(email, code)
      : this.challengeService.verifyExistingEmail(email, code);
  }

  /**
   * 重置密碼（不洩漏用戶是否存在）
   */
  async resetPassword(email: string, locale: BackendLocale = 'zh-TW'): Promise<void> {
    const normalizedEmail = normalizeAuthEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, is_active: true },
    });

    if (!user?.is_active) return;

    try {
      await this.challengeService.issue(normalizedEmail, 'reset_password', locale);
    } catch {
      logger.error('Password reset delivery was not accepted');
    }
  }

  /**
   * 確認重置密碼（成功後使所有現有 Token 失效）
   */
  async confirmResetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const normalizedEmail = normalizeAuthEmail(email);

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw Errors.WEAK_PASSWORD(passwordValidation.message);
    }

    const passwordHash = await hashPassword(newPassword);

    const verificationError = await prisma.$transaction(async (tx) => {
      const challengeError = await this.challengeService.verifyAndConsumeResetCode(
        tx,
        normalizedEmail,
        code
      );
      if (challengeError) return challengeError;
      await tx.user.update({
        where: { email: normalizedEmail },
        data: {
          password_hash: passwordHash,
          token_version: { increment: 1 },
          login_failed_attempts: 0,
          locked_until: null,
        },
      });
      return null;
    });

    if (verificationError) throw verificationError;

    logger.info('Password reset completed; existing sessions invalidated');
  }

  /**
   * 關聯匿名 session 產生的資產到已註冊用戶。
   * 這是弱依賴升格動作：外部仍只返回主 case_id，但內部會一併接管
   * 同 session 下尚未歸屬的 quick/collaborative case、配對、聊天室與證據。
   */
  async claimSession(userId: string, sessionId: string): Promise<{ case_id: string | null }> {
    const session = await prisma.quickSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { case_id: null };
    }
    if (session.expires_at < new Date()) {
      logger.info('Expired session claim ignored', { userId, sessionId });
      prisma.quickSession.delete({ where: { id: sessionId } }).catch((error) => {
        logger.debug('Failed to delete expired session during claim', { sessionId, error });
      });
      return { case_id: null };
    }

    const linkedCase = session.case_id
      ? await prisma.case.findUnique({ where: { id: session.case_id } })
      : null;

    const canReturnLinkedCase = Boolean(linkedCase && isClaimableSessionCase(linkedCase, sessionId));

    const claimed = await prisma.$transaction(async (tx) => {
      const cases = await tx.case.updateMany({
        where: {
          plaintiff_id: null,
          ...buildClaimableSessionCaseWhere(sessionId),
        },
        data: { plaintiff_id: userId },
      });

      const pairings = await tx.pairing.updateMany({
        where: {
          ...buildSessionBoundQuickPairingWhere(sessionId),
          user1_id: null,
        },
        data: { user1_id: userId },
      });

      const chatRooms = await tx.chatRoom.updateMany({
        where: {
          session_id: sessionId,
          owner_user_id: null,
        },
        data: { owner_user_id: userId },
      });

      const chatParticipants = await tx.chatParticipant.updateMany({
        where: {
          user_id: null,
          role_in_room: 'roleA',
          room: { session_id: sessionId },
        },
        data: { user_id: userId },
      });

      const evidences = await tx.evidence.updateMany({
        where: {
          user_id: null,
          case: buildClaimableSessionCaseWhere(sessionId),
        },
        data: { user_id: userId },
      });

      return {
        cases: cases.count,
        pairings: pairings.count,
        chatRooms: chatRooms.count,
        chatParticipants: chatParticipants.count,
        evidences: evidences.count,
      };
    });

    logger.info('Session assets claimed by user', {
      userId,
      sessionId,
      caseId: canReturnLinkedCase ? linkedCase!.id : null,
      claimed,
    });

    return { case_id: canReturnLinkedCase ? linkedCase!.id : null };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export const authService = new AuthService();
