/**
 * EmailService 單元測試（mock nodemailer、env、prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn();

const mockEnvRef = {
  SMTP_HOST: undefined as string | undefined,
  SMTP_USER: undefined as string | undefined,
  SMTP_PASS: undefined as string | undefined,
  SMTP_PORT: 587,
  EMAIL_FROM: undefined as string | undefined,
  get EMAIL_DELIVERY() {
    if (!this.SMTP_HOST) {
      return { mode: 'disabled' as const, transportVerifyTimeoutMs: 1000 };
    }
    return {
      mode: 'smtp' as const,
      from: this.EMAIL_FROM || this.SMTP_USER,
      otpPepper: 'test-email-otp-pepper-at-least-32-characters',
      transportVerifyTimeoutMs: 1000,
      smtp: {
        host: this.SMTP_HOST,
        port: this.SMTP_PORT,
        user: this.SMTP_USER,
        pass: this.SMTP_PASS,
        secure: false,
        requireTls: true,
      },
    };
  },
};

jest.mock('nodemailer', () => ({
  createTransport: () => mockCreateTransport(),
}));
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef;
  },
}));
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// sendPairingNotification / sendJudgmentNotification 動態 import prisma
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbMock: any = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};
jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: dbMock,
}));

import { EmailService } from '../../../src/services/email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvRef.SMTP_HOST = undefined;
    mockEnvRef.SMTP_USER = undefined;
    mockEnvRef.SMTP_PASS = undefined;
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail, verify: jest.fn() });
    service = new EmailService();
  });

  describe('sendVerificationCode', () => {
    it('未配置 SMTP 時不得靜默成功', async () => {
      mockEnvRef.SMTP_HOST = undefined;
      const svc = new EmailService();

      await expect(svc.sendVerificationCode('a@b.com', '123456', 'register'))
        .rejects.toMatchObject({ reason: 'not_configured' });
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Verification email delivery unavailable', {
        purpose: 'register',
        reason: 'not_configured',
      });
    });

    it('已配置 SMTP 時應調用 sendMail', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['a@b.com'],
        rejected: [],
        messageId: 'register-message-id',
      } as never);

      await svc.sendVerificationCode('a@b.com', '123456', 'register');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@b.com',
          subject: expect.stringContaining('註冊'),
          text: expect.stringContaining('123456'),
        })
      );
    });

    it('reset_password 類型應使用對應 subject', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['a@b.com'],
        rejected: [],
        messageId: 'reset-message-id',
      } as never);

      await svc.sendVerificationCode('a@b.com', '654321', 'reset_password');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('重置密碼'),
          text: expect.stringContaining('654321'),
        })
      );
    });

    it('en-US locale 應發送英文驗證碼郵件', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['a@b.com'],
        rejected: [],
        messageId: 'en-message-id',
      } as never);

      await svc.sendVerificationCode('a@b.com', '123456', 'register', 'en-US');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('Emorapy'),
          subject: 'Welcome to Emorapy - Verify your email',
          text: 'Your verification code is 123456. It expires in 5 minutes.',
          html: expect.stringContaining('If you did not request this code'),
        })
      );
    });

    it('sendMail 失敗時應記錄 logger.error 並拋錯', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      const err = new Error('SMTP connection failed');
      (mockSendMail as jest.Mock).mockRejectedValue(err as never);

      await expect(svc.sendVerificationCode('a@b.com', '123456', 'register'))
        .rejects.toMatchObject({ reason: 'transport_unavailable' });
      expect(mockLogger.error).toHaveBeenCalledWith('Verification email delivery failed', {
        purpose: 'register',
        reason: 'transport_unavailable',
        providerCode: undefined,
      });
      expect(svc.getReadiness()).toMatchObject({ mode: 'smtp', status: 'unavailable' });
    });

    it('provider 未回報任何 accepted recipient 時應 fail closed', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: [],
        rejected: [],
      } as never);

      await expect(svc.sendVerificationCode('a@b.com', '123456', 'register'))
        .rejects.toMatchObject({ reason: 'recipient_rejected' });
      expect(mockLogger.error).toHaveBeenCalledWith('Verification email delivery failed', {
        purpose: 'register',
        reason: 'recipient_rejected',
        providerCode: undefined,
      });
      expect(svc.getReadiness()).toMatchObject({ mode: 'smtp', status: 'pending' });
    });

    it('recipient rejection 不得將已驗證的全局 transport 降級', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const verify = jest.fn<() => Promise<true>>().mockResolvedValue(true);
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail, verify });
      const svc = new EmailService();
      await svc.initialize();
      (mockSendMail as jest.Mock).mockRejectedValue(Object.assign(new Error('recipient rejected'), {
        code: 'EENVELOPE',
        command: 'RCPT TO',
        rejected: ['a@b.com'],
      }) as never);

      await expect(svc.sendVerificationCode('a@b.com', '123456', 'register'))
        .rejects.toMatchObject({ reason: 'recipient_rejected' });

      expect(svc.getReadiness()).toMatchObject({
        mode: 'smtp',
        status: 'ready',
        verifiedAt: expect.any(String),
      });
    });

    it('transport outage 後的 provider accepted 應恢復 ready 並保留 startup verifiedAt', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const verify = jest.fn<() => Promise<true>>().mockResolvedValue(true);
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail, verify });
      const svc = new EmailService();
      await svc.initialize();
      const verifiedAt = svc.getReadiness().verifiedAt;

      (mockSendMail as jest.Mock).mockRejectedValueOnce(new Error('SMTP connection failed') as never);
      await expect(svc.sendVerificationCode('a@b.com', '123456', 'register'))
        .rejects.toMatchObject({ reason: 'transport_unavailable' });
      expect(svc.getReadiness()).toMatchObject({ status: 'unavailable', verifiedAt });

      (mockSendMail as jest.Mock).mockResolvedValueOnce({
        accepted: ['a@b.com'],
        rejected: [],
        messageId: 'recovery-message-id',
      } as never);
      await svc.sendVerificationCode('a@b.com', '654321', 'register');

      expect(svc.getReadiness()).toMatchObject({
        mode: 'smtp',
        status: 'ready',
        verifiedAt,
        lastAcceptedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
    });
  });

  describe('sendProviderCanary', () => {
    it('只在 provider 接受收件人時回傳低敏 receipt', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['canary@example.com'],
        rejected: [],
        messageId: 'provider-message-id',
      } as never);

      const receipt = await svc.sendProviderCanary('canary@example.com', 'abc123');

      expect(receipt.acceptedAt).toBeInstanceOf(Date);
      expect(receipt.providerMessageIdDigest).toMatch(/^[0-9a-f]{16}$/);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'canary@example.com',
        subject: expect.stringContaining('abc123'),
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('Email provider canary accepted', {
        purpose: 'provider_canary',
        releaseRef: 'abc123',
      });
    });

    it('provider 未接受收件人時 fail closed', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: [],
        rejected: ['canary@example.com'],
      } as never);

      await expect(svc.sendProviderCanary('canary@example.com', 'abc123'))
        .rejects.toMatchObject({ reason: 'recipient_rejected' });
      expect(mockLogger.error).toHaveBeenCalledWith('Email provider canary failed', {
        purpose: 'provider_canary',
        releaseRef: 'abc123',
        reason: 'recipient_rejected',
        providerCode: undefined,
      });
      expect(svc.getReadiness()).toMatchObject({ mode: 'smtp', status: 'pending' });
    });
  });

  describe('sendPairingNotification', () => {
    it('未配置 SMTP 時應靜默返回', async () => {
      mockEnvRef.SMTP_HOST = undefined;
      const svc = new EmailService();

      await expect(svc.sendPairingNotification('u1', 'u2')).resolves.toBeUndefined();
      expect(dbMock.user.findMany).not.toHaveBeenCalled();
    });

    it('已配置 SMTP 時應查詢用戶並發送', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findMany.mockResolvedValue([
        { email: 'u1@x.com', nickname: 'U1', language: 'zh' },
        { email: 'u2@x.com', nickname: 'U2', language: 'zh' },
      ]);
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['recipient@example.com'],
        rejected: [],
      } as never);

      await svc.sendPairingNotification('u1', 'u2');

      expect(dbMock.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1', 'u2'] } },
        select: { email: true, nickname: true, language: true },
      });
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(svc.getReadiness()).toMatchObject({
        mode: 'smtp',
        status: 'ready',
        lastAcceptedAt: expect.any(String),
      });
    });

    it('配對通知應按每位收件人的 language 發送對應語言', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findMany.mockResolvedValue([
        { email: 'u1@x.com', nickname: 'U1', language: 'zh' },
        { email: 'u2@x.com', nickname: 'U2', language: 'en' },
      ]);
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['recipient@example.com'],
        rejected: [],
      } as never);

      await svc.sendPairingNotification('u1', 'u2');

      expect(mockSendMail).toHaveBeenNthCalledWith(1, expect.objectContaining({
        to: 'u1@x.com',
        subject: '配對成功通知 - Emorapy',
        html: expect.stringContaining('查看梳理結果'),
      }));
      expect(mockSendMail).toHaveBeenNthCalledWith(2, expect.objectContaining({
        to: 'u2@x.com',
        subject: 'Pairing confirmed - Emorapy',
        html: expect.stringContaining('view the Analysis'),
      }));
    });

    it('有用戶無 email 時應跳過該用戶只發送有 email 的', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findMany.mockResolvedValue([
        { email: 'u1@x.com', nickname: 'U1', language: 'zh' },
        { email: null, nickname: 'U2', language: 'zh' },
      ]);
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['u1@x.com'],
        rejected: [],
      } as never);

      await svc.sendPairingNotification('u1', 'u2');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'u1@x.com' }));
    });

    it('findMany 返回空陣列時應不發送且不拋錯（候選功能邊界：雙方皆不存在）', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findMany.mockResolvedValue([]);

      await expect(svc.sendPairingNotification('u-missing-1', 'u-missing-2')).resolves.toBeUndefined();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('DB 查詢失敗不得誤判為 SMTP transport outage', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findMany.mockRejectedValue(new Error('database unavailable'));

      await expect(svc.sendPairingNotification('u1', 'u2')).resolves.toBeUndefined();

      expect(svc.getReadiness()).toMatchObject({ mode: 'smtp', status: 'pending' });
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('sendPairingNotification 發送失敗時應記錄 logger.error 且不拋錯', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findMany.mockResolvedValue([{ email: 'u1@x.com', nickname: 'U1', language: 'zh' }]);
      (mockSendMail as jest.Mock).mockRejectedValue(new Error('send failed') as never);

      await expect(svc.sendPairingNotification('u1', 'u2')).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Notification email delivery failed', {
        purpose: 'pairing',
        providerCode: undefined,
      });
      expect(svc.getReadiness()).toMatchObject({ mode: 'smtp', status: 'unavailable' });
    });
  });

  describe('sendJudgmentNotification', () => {
    it('未配置 SMTP 時應靜默返回', async () => {
      mockEnvRef.SMTP_HOST = undefined;
      const svc = new EmailService();

      await expect(svc.sendJudgmentNotification('u1', 'case-1')).resolves.toBeUndefined();
      expect(dbMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('用戶無郵箱時應靜默返回', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findUnique.mockResolvedValue({ email: null, nickname: 'U', language: 'zh' });

      await svc.sendJudgmentNotification('u1', 'case-1');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('用戶不存在時應靜默返回（候選功能邊界：findUnique 返回 null 不拋錯）', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findUnique.mockResolvedValue(null);

      await svc.sendJudgmentNotification('u-missing', 'case-1');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('有用戶郵箱時應發送', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findUnique.mockResolvedValue({ email: 'u@x.com', nickname: 'U', language: 'zh' });
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['u@x.com'],
        rejected: [],
      } as never);

      await svc.sendJudgmentNotification('u1', 'case-1');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'u@x.com',
          subject: expect.stringContaining('梳理結果完成'),
          html: expect.stringContaining('梳理結果已完成'),
        })
      );
    });

    it('英文用戶應收到英文 Analysis 完成通知', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findUnique.mockResolvedValue({ email: 'u@x.com', nickname: 'U', language: 'en' });
      (mockSendMail as jest.Mock).mockResolvedValue({
        accepted: ['u@x.com'],
        rejected: [],
      } as never);

      await svc.sendJudgmentNotification('u1', 'case-1');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'u@x.com',
          subject: 'Analysis ready - Emorapy',
          html: expect.stringContaining('Your Analysis is ready'),
        })
      );
    });

    it('sendJudgmentNotification 發送失敗時應記錄 logger.error 且不拋錯', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findUnique.mockResolvedValue({ email: 'u@x.com', nickname: 'U', language: 'zh' });
      (mockSendMail as jest.Mock).mockRejectedValue(new Error('send failed') as never);

      await expect(svc.sendJudgmentNotification('u1', 'case-1')).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Notification email delivery failed', {
        purpose: 'analysis_ready',
        providerCode: undefined,
      });
      expect(svc.getReadiness()).toMatchObject({ mode: 'smtp', status: 'unavailable' });
    });
  });
});
