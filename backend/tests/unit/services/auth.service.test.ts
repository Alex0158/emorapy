/**
 * AuthService 單元測試（mock Prisma、password、jwt 與 secure auth challenge）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock 函數用 any 避免 Jest 泛型與 mockResolvedValue 的類型衝突
const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();
const mockGenerateToken = jest.fn();
const mockValidatePasswordStrength = jest.fn();
const mockIssueChallenge = jest.fn();
const mockVerifyRegistrationCode = jest.fn();
const mockVerifyExistingEmail = jest.fn();
const mockConsumeRegistrationProof = jest.fn();
const mockVerifyAndConsumeResetCode = jest.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  $transaction: jest.fn(),
  quickSession: {
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
  case: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  pairing: {
    updateMany: jest.fn(),
  },
  chatRoom: {
    updateMany: jest.fn(),
  },
  chatParticipant: {
    updateMany: jest.fn(),
  },
  evidence: {
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
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
import { AuthService } from '../../../src/services/auth.service';
import { Errors } from '../../../src/utils/errors';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        user: {
          create: prismaMock.user.create,
          update: prismaMock.user.update,
        },
        case: {
          updateMany: prismaMock.case.updateMany,
        },
        pairing: {
          updateMany: prismaMock.pairing.updateMany,
        },
        chatRoom: {
          updateMany: prismaMock.chatRoom.updateMany,
        },
        chatParticipant: {
          updateMany: prismaMock.chatParticipant.updateMany,
        },
        evidence: {
          updateMany: prismaMock.evidence.updateMany,
        },
      };
      return fn(tx);
    });
    prismaMock.case.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.pairing.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.chatRoom.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.chatParticipant.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.evidence.updateMany.mockResolvedValue({ count: 0 });
    service = new AuthService({
      issue: (...args: unknown[]) => mockIssueChallenge(...args),
      verifyRegistrationCode: (...args: unknown[]) => mockVerifyRegistrationCode(...args),
      verifyExistingEmail: (...args: unknown[]) => mockVerifyExistingEmail(...args),
      consumeRegistrationProof: (...args: unknown[]) => mockConsumeRegistrationProof(...args),
      verifyAndConsumeResetCode: (...args: unknown[]) => mockVerifyAndConsumeResetCode(...args),
    } as never);
  });

  describe('register', () => {
    it('郵箱格式無效應拋出 INVALID_EMAIL', async () => {
      await expect(service.register({
        email: 'not-an-email',
        password: 'ValidPass1!',
        registration_proof: 'rp1_invalid',
      })).rejects.toMatchObject({ code: 'INVALID_EMAIL' });
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('郵箱已存在應拋出 EMAIL_EXISTS', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await expect(service.register({
        email: 'a@b.com',
        password: 'ValidPass1!',
        registration_proof: 'rp1_invalid',
      })).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
    });

    it('密碼強度不足應拋出 WEAK_PASSWORD', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      mockValidatePasswordStrength.mockReturnValue({ valid: false, message: '弱' });

      await expect(service.register({
        email: 'a@b.com',
        password: 'weak',
        registration_proof: 'rp1_invalid',
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
        email_verified: true,
        created_at: new Date(),
      });
      (mockConsumeRegistrationProof as jest.Mock).mockResolvedValue(undefined as never);
      mockGenerateToken.mockReturnValue('jwt-token');

      const result = await service.register({
        email: 'a@b.com',
        password: 'ValidPass1!',
        nickname: 'User',
        registration_proof: `rp1_${'a'.repeat(43)}`,
      });

      expect(result.user.email).toBe('a@b.com');
      expect(result.token).toBe('jwt-token');
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'a@b.com',
          password_hash: 'hashed',
          nickname: 'User',
          email_verified: true,
        }),
        select: expect.any(Object),
      });
      expect(mockConsumeRegistrationProof).toHaveBeenCalledWith(
        expect.any(Object),
        'a@b.com',
        `rp1_${'a'.repeat(43)}`
      );
    });

    it('proof 無效時應中止 transaction，不得建立未驗證帳戶', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      mockValidatePasswordStrength.mockReturnValue({ valid: true });
      (mockHashPassword as jest.Mock).mockResolvedValue('hashed' as never);
      (mockConsumeRegistrationProof as jest.Mock).mockRejectedValue(
        Object.assign(new Error('proof invalid'), { code: 'REGISTRATION_PROOF_INVALID' }) as never
      );

      await expect(service.register({
        email: 'a@b.com',
        password: 'ValidPass1!',
        registration_proof: `rp1_${'b'.repeat(43)}`,
      })).rejects.toMatchObject({ code: 'REGISTRATION_PROOF_INVALID' });

      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(mockGenerateToken).not.toHaveBeenCalled();
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
        login_failed_attempts: 0,
        locked_until: null,
        token_version: 0,
      });
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockComparePassword.mockResolvedValue(false);
      prismaMock.user.update.mockResolvedValue({});

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
        login_failed_attempts: 0,
        locked_until: null,
        token_version: 0,
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
        login_failed_attempts: 0,
        locked_until: null,
        token_version: 0,
      });
      // @ts-expect-error mock 在 jest.mock 後推斷為 never
      mockComparePassword.mockResolvedValue(true);

      await expect(service.login({
        email: 'a@b.com',
        password: 'pass',
      })).rejects.toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
        message: expect.stringContaining('郵箱驗證'),
      });
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
        login_failed_attempts: 0,
        locked_until: null,
        token_version: 0,
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
      expect(result.expires_in).toBe(24 * 60 * 60);
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
        login_failed_attempts: 0,
        locked_until: null,
        token_version: 0,
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
    it('註冊 email 已存在時應拋出 EMAIL_EXISTS', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

      await expect(service.sendVerificationCode('a@b.com', 'register'))
        .rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
      expect(mockIssueChallenge).not.toHaveBeenCalled();
    });

    it('成功應由 secure challenge service 發送，並正規化 email', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email_verified: false,
        is_active: true,
      });
      (mockIssueChallenge as jest.Mock).mockResolvedValue({
        expires_in: 300,
        resend_after: 60,
      } as never);

      await expect(service.sendVerificationCode(' A@B.COM ', 'verify_email', 'en-US'))
        .resolves.toEqual({ expires_in: 300, resend_after: 60 });

      expect(mockIssueChallenge).toHaveBeenCalledWith(
        'a@b.com',
        'verify_email',
        'en-US'
      );
    });

    it('verify_email 不存在或已驗證帳戶仍返回中性 cooldown contract', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.sendVerificationCode('missing@example.com', 'verify_email'))
        .resolves.toEqual({ expires_in: 300, resend_after: 60 });
      expect(mockIssueChallenge).not.toHaveBeenCalled();

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u1',
        email_verified: true,
        is_active: true,
      });
      await expect(service.sendVerificationCode('verified@example.com', 'verify_email'))
        .resolves.toEqual({ expires_in: 300, resend_after: 60 });
      expect(mockIssueChallenge).not.toHaveBeenCalled();
    });

    it('密碼重置不得透過通用驗證碼 endpoint 申請', async () => {
      await expect(
        service.sendVerificationCode('a@b.com', 'reset_password' as never)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('verifyEmail', () => {
    it('register 驗證應返回一次性 registration proof', async () => {
      const proofResult = {
        verified: true as const,
        registration_proof: `rp1_${'c'.repeat(43)}`,
        registration_proof_expires_in: 600,
      };
      (mockVerifyRegistrationCode as jest.Mock).mockResolvedValue(proofResult as never);

      await expect(service.verifyEmail('A@B.COM', '123456', 'register'))
        .resolves.toEqual(proofResult);
      expect(mockVerifyRegistrationCode).toHaveBeenCalledWith('A@B.COM', '123456');
    });

    it('verify_email 驗證不得回傳 proof', async () => {
      (mockVerifyExistingEmail as jest.Mock).mockResolvedValue({ verified: true } as never);

      const result = await service.verifyEmail('a@b.com', '123456', 'verify_email');

      expect(result).toEqual({ verified: true });
      expect(result).not.toHaveProperty('registration_proof');
    });
  });

  describe('resetPassword', () => {
    it('用戶不存在應靜默返回（不拋錯）', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('nonexistent@b.com')).resolves.toBeUndefined();
      expect(mockIssueChallenge).not.toHaveBeenCalled();
    });

    it('用戶存在應發送重置驗證碼', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', is_active: true });
      (mockIssueChallenge as jest.Mock).mockResolvedValue(undefined as never);

      await service.resetPassword(' A@B.COM ');

      expect(mockIssueChallenge).toHaveBeenCalledWith(
        'a@b.com',
        'reset_password',
        'zh-TW'
      );
    });

    it('供應商未接受郵件時仍保持靜默回應', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', is_active: true });
      (mockIssueChallenge as jest.Mock).mockRejectedValue(new Error('provider unavailable') as never);

      await expect(service.resetPassword('a@b.com')).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Password reset delivery was not accepted');
    });
  });

  describe('confirmResetPassword', () => {
    it('驗證碼無效應拋出 INVALID_CODE', async () => {
      mockValidatePasswordStrength.mockReturnValue({ valid: true });
      (mockHashPassword as jest.Mock).mockResolvedValue('newHash' as never);
      (mockVerifyAndConsumeResetCode as jest.Mock).mockResolvedValue(Errors.INVALID_CODE() as never);

      await expect(service.confirmResetPassword('a@b.com', '000000', 'NewPass1!'))
        .rejects.toMatchObject({ code: 'INVALID_CODE' });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('新密碼強度不足應拋出 WEAK_PASSWORD', async () => {
      mockValidatePasswordStrength.mockReturnValue({ valid: false, message: '弱' });

      await expect(service.confirmResetPassword('a@b.com', '123456', 'weak'))
        .rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
      expect(mockVerifyAndConsumeResetCode).not.toHaveBeenCalled();
    });

    it('成功應在同一 transaction 消費驗證碼並遞增 token_version', async () => {
      mockValidatePasswordStrength.mockReturnValue({ valid: true });
      (mockHashPassword as jest.Mock).mockResolvedValue('newHash' as never);
      (mockVerifyAndConsumeResetCode as jest.Mock).mockResolvedValue(null as never);
      prismaMock.user.update.mockResolvedValue({});

      await service.confirmResetPassword('a@b.com', '123456', 'NewPass1!');

      expect(mockHashPassword).toHaveBeenCalledWith('NewPass1!');
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(mockVerifyAndConsumeResetCode).toHaveBeenCalledWith(
        expect.any(Object),
        'a@b.com',
        '123456'
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
        data: {
          password_hash: 'newHash',
          token_version: { increment: 1 },
          login_failed_attempts: 0,
          locked_until: null,
        },
      });
    });
  });

  describe('claimSession', () => {
    it('session 不存在時應返回 null case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue(null);

      await expect(service.claimSession('user-1', 'missing-session')).resolves.toEqual({
        case_id: null,
      });
      expect(prismaMock.case.findUnique).not.toHaveBeenCalled();
    });

    it('session 已過期時應忽略 claim 並返回 null case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({
        id: 's1',
        case_id: 'case-1',
        expires_at: new Date(Date.now() - 1000),
      });
      prismaMock.quickSession.delete.mockResolvedValue({});

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: null,
      });
      expect(prismaMock.case.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.quickSession.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
      expect(mockLogger.info).toHaveBeenCalledWith('Expired session claim ignored', {
        userId: 'user-1',
        sessionId: 's1',
      });
    });

    it('session 存在但沒有 case_id 時應返回 null case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1', case_id: null });

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: null,
      });
      expect(prismaMock.case.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.chatRoom.updateMany).toHaveBeenCalledWith({
        where: {
          session_id: 's1',
          owner_user_id: null,
        },
        data: { owner_user_id: 'user-1' },
      });
    });

    it('關聯案件不存在時應返回 null case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1', case_id: 'case-1' });
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: null,
      });
      expect(prismaMock.case.updateMany).toHaveBeenCalled();
    });

    it('關聯案件存在但非 quick 模式時應返回 null case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1', case_id: 'case-1' });
      prismaMock.case.findUnique.mockResolvedValue({ id: 'case-1', mode: 'remote' });

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: null,
      });
      expect(prismaMock.case.updateMany).toHaveBeenCalledWith({
        where: {
          plaintiff_id: null,
          OR: [
            {
              mode: 'quick',
              OR: [
                { session_id: 's1' },
                { quick_sessions: { some: { id: 's1' } } },
              ],
            },
            { mode: 'collaborative', session_id: 's1' },
          ],
        },
        data: { plaintiff_id: 'user-1' },
      });
    });

    it('quick case 已被 claim 時仍應接管同 session 其他匿名資產並返回既有 case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1', case_id: 'case-1' });
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'quick',
        plaintiff_id: 'existing-user',
        session_id: 's1',
      });

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: 'case-1',
      });
      expect(prismaMock.case.updateMany).toHaveBeenCalled();
      expect(prismaMock.pairing.updateMany).toHaveBeenCalled();
    });

    it('可用 quick case 應交易式接管 session 資產並返回 case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1', case_id: 'case-1' });
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'quick',
        plaintiff_id: null,
        session_id: 's1',
      });
      prismaMock.case.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.pairing.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.chatRoom.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.chatParticipant.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.evidence.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: 'case-1',
      });
      expect(prismaMock.case.updateMany).toHaveBeenCalledWith({
        where: {
          plaintiff_id: null,
          OR: [
            {
              mode: 'quick',
              OR: [
                { session_id: 's1' },
                { quick_sessions: { some: { id: 's1' } } },
              ],
            },
            { mode: 'collaborative', session_id: 's1' },
          ],
        },
        data: { plaintiff_id: 'user-1' },
      });
      expect(prismaMock.pairing.updateMany).toHaveBeenCalledWith({
        where: {
          session_id: 's1',
          pairing_type: 'quick',
          status: 'temp',
          user1_id: null,
        },
        data: { user1_id: 'user-1' },
      });
      expect(prismaMock.chatRoom.updateMany).toHaveBeenCalledWith({
        where: {
          session_id: 's1',
          owner_user_id: null,
        },
        data: { owner_user_id: 'user-1' },
      });
      expect(prismaMock.chatParticipant.updateMany).toHaveBeenCalledWith({
        where: {
          user_id: null,
          role_in_room: 'roleA',
          room: { session_id: 's1' },
        },
        data: { user_id: 'user-1' },
      });
      expect(prismaMock.evidence.updateMany).toHaveBeenCalledWith({
        where: {
          user_id: null,
          case: {
            OR: [
              {
                mode: 'quick',
                OR: [
                  { session_id: 's1' },
                  { quick_sessions: { some: { id: 's1' } } },
                ],
              },
              { mode: 'collaborative', session_id: 's1' },
            ],
          },
        },
        data: { user_id: 'user-1' },
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Session assets claimed by user', {
        userId: 'user-1',
        caseId: 'case-1',
        sessionId: 's1',
        claimed: {
          cases: 1,
          pairings: 1,
          chatRooms: 1,
          chatParticipants: 1,
          evidences: 2,
        },
      });
    });

    it('競態下 updateMany 未更新任何資料時仍應返回既有 case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1', case_id: 'case-1' });
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'quick',
        plaintiff_id: null,
        session_id: 's1',
      });
      prismaMock.case.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: 'case-1',
      });
    });

    it('session-bound collaborative case 也應可 claim 並返回 case_id', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1', case_id: 'case-1' });
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'collaborative',
        plaintiff_id: null,
        session_id: 's1',
      });

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: 'case-1',
      });
      expect(prismaMock.case.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { mode: 'collaborative', session_id: 's1' },
          ]),
        }),
      }));
    });

    it('非同 session 的 collaborative case 不應作為 claim-session 主 case 返回', async () => {
      prismaMock.quickSession.findUnique.mockResolvedValue({ id: 's1', case_id: 'case-1' });
      prismaMock.case.findUnique.mockResolvedValue({
        id: 'case-1',
        mode: 'collaborative',
        plaintiff_id: null,
        session_id: 'other-session',
      });

      await expect(service.claimSession('user-1', 's1')).resolves.toEqual({
        case_id: null,
      });
    });
  });
});
