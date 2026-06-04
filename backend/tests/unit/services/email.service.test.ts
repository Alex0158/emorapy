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
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
    service = new EmailService();
  });

  describe('sendVerificationCode', () => {
    it('未配置 SMTP 時應靜默返回', async () => {
      mockEnvRef.SMTP_HOST = undefined;
      const svc = new EmailService();

      await expect(svc.sendVerificationCode('a@b.com', '123456', 'register')).resolves.toBeUndefined();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('已配置 SMTP 時應調用 sendMail', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      // @ts-expect-error mock 泛型推斷為 never
      mockSendMail.mockResolvedValue(undefined);

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
      // @ts-expect-error mock 泛型推斷為 never
      mockSendMail.mockResolvedValue(undefined);

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
      // @ts-expect-error mock 泛型推斷為 never
      mockSendMail.mockResolvedValue(undefined);

      await svc.sendVerificationCode('a@b.com', '123456', 'register', 'en-US');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('CJ Platform'),
          subject: 'Welcome to CJ Platform - Verify your email',
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

      await expect(svc.sendVerificationCode('a@b.com', '123456', 'register')).rejects.toThrow('SMTP connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send verification email', {
        email: 'a@b.com',
        type: 'register',
        error: err,
      });
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
      // @ts-expect-error mock 泛型推斷為 never
      mockSendMail.mockResolvedValue(undefined);

      await svc.sendPairingNotification('u1', 'u2');

      expect(dbMock.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1', 'u2'] } },
        select: { email: true, nickname: true, language: true },
      });
      expect(mockSendMail).toHaveBeenCalledTimes(2);
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
      // @ts-expect-error mock 泛型推斷為 never
      mockSendMail.mockResolvedValue(undefined);

      await svc.sendPairingNotification('u1', 'u2');

      expect(mockSendMail).toHaveBeenNthCalledWith(1, expect.objectContaining({
        to: 'u1@x.com',
        subject: '配對成功通知 - CJ 平台',
        html: expect.stringContaining('查看梳理結果'),
      }));
      expect(mockSendMail).toHaveBeenNthCalledWith(2, expect.objectContaining({
        to: 'u2@x.com',
        subject: 'Pairing confirmed - CJ Platform',
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
      (mockSendMail as jest.Mock).mockResolvedValue(undefined as never);

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

    it('sendPairingNotification 發送失敗時應記錄 logger.error 且不拋錯', async () => {
      mockEnvRef.SMTP_HOST = 'smtp.example.com';
      mockEnvRef.SMTP_USER = 'noreply@example.com';
      mockEnvRef.SMTP_PASS = 'secret';
      const svc = new EmailService();
      dbMock.user.findMany.mockResolvedValue([{ email: 'u1@x.com', nickname: 'U1', language: 'zh' }]);
      (mockSendMail as jest.Mock).mockRejectedValue(new Error('send failed') as never);

      await expect(svc.sendPairingNotification('u1', 'u2')).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send pairing notification', {
        userId1: 'u1',
        userId2: 'u2',
        error: expect.any(Error),
      });
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
      // @ts-expect-error mock 泛型推斷為 never
      mockSendMail.mockResolvedValue(undefined);

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
      // @ts-expect-error mock 泛型推斷為 never
      mockSendMail.mockResolvedValue(undefined);

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
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send analysis notification', {
        userId: 'u1',
        caseId: 'case-1',
        error: expect.any(Error),
      });
    });
  });
});
