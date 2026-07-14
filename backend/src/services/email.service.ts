import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import crypto from 'crypto';
import { env } from '../config/env';
import logger from '../config/logger';
import type { BackendLocale } from '../i18n';
import type { EmailDeliveryConfig } from '../config/email-delivery';
import {
  createResendApiTransport,
  type EmailTransport,
} from './resend-api-transport';

type VerificationEmailType = 'register' | 'reset_password' | 'verify_email';

interface VerificationCopy {
  subject: string;
  text: (code: string) => string;
}

interface EmailCopy {
  fromName: string;
  verification: Record<VerificationEmailType, VerificationCopy>;
  noRequestNotice: string;
  pairing: {
    subject: string;
    heading: string;
    body: string;
  };
  analysisReady: {
    subject: string;
    heading: string;
    body: string;
  };
}

const EMAIL_COPY: Record<BackendLocale, EmailCopy> = {
  'zh-TW': {
    fromName: 'Emorapy',
    verification: {
      register: {
        subject: '歡迎註冊 Emorapy - 請驗證您的郵箱',
        text: (code) => `您的驗證碼是：${code}，有效期5分鐘。`,
      },
      reset_password: {
        subject: '重置密碼 - Emorapy',
        text: (code) => `您的重置密碼驗證碼是：${code}，有效期5分鐘。`,
      },
      verify_email: {
        subject: '驗證郵箱 - Emorapy',
        text: (code) => `您的驗證碼是：${code}，有效期5分鐘。`,
      },
    },
    noRequestNotice: '如果您沒有請求此驗證碼，請忽略此郵件。',
    pairing: {
      subject: '配對成功通知 - Emorapy',
      heading: '配對成功',
      body: '你們的配對已生效，現在可以創建案件並查看梳理結果。',
    },
    analysisReady: {
      subject: '梳理結果完成通知 - Emorapy',
      heading: '梳理結果已完成',
      body: '您提交的案件已完成梳理結果，請登入查看詳細內容。',
    },
  },
  'en-US': {
    fromName: 'Emorapy',
    verification: {
      register: {
        subject: 'Welcome to Emorapy - Verify your email',
        text: (code) => `Your verification code is ${code}. It expires in 5 minutes.`,
      },
      reset_password: {
        subject: 'Reset your password - Emorapy',
        text: (code) => `Your password reset verification code is ${code}. It expires in 5 minutes.`,
      },
      verify_email: {
        subject: 'Verify your email - Emorapy',
        text: (code) => `Your verification code is ${code}. It expires in 5 minutes.`,
      },
    },
    noRequestNotice: 'If you did not request this code, you can ignore this email.',
    pairing: {
      subject: 'Pairing confirmed - Emorapy',
      heading: 'Pairing confirmed',
      body: 'Your pairing is active. You can now create a case and view the Analysis when it is ready.',
    },
    analysisReady: {
      subject: 'Analysis ready - Emorapy',
      heading: 'Your Analysis is ready',
      body: 'The case you submitted has an Analysis ready. Please log in to view the details.',
    },
  },
};

function resolveEmailLocale(locale?: BackendLocale): BackendLocale {
  return locale === 'en-US' ? 'en-US' : 'zh-TW';
}

function localeFromUserLanguage(language: unknown): BackendLocale {
  return language === 'en' ? 'en-US' : 'zh-TW';
}

export type EmailDeliveryFailureReason = 'not_configured' | 'transport_unavailable' | 'recipient_rejected';

export class EmailDeliveryError extends Error {
  constructor(
    public readonly reason: EmailDeliveryFailureReason,
    public readonly providerCode?: string
  ) {
    super(`Email delivery failed: ${reason}`);
    this.name = 'EmailDeliveryError';
  }
}

export interface EmailDeliveryReceipt {
  acceptedAt: Date;
  providerMessageIdDigest?: string;
}

export interface EmailDeliveryReadiness {
  mode: EmailDeliveryConfig['mode'];
  status: 'disabled' | 'pending' | 'ready' | 'unavailable';
  verifiedAt?: string;
  lastAcceptedAt?: string;
}

type TransportFactory = (options: SMTPTransport.Options) => nodemailer.Transporter;
type ResendTransportFactory = typeof createResendApiTransport;

function resolveProviderCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  const value = String((error as { code?: unknown }).code ?? '');
  return /^[A-Z0-9_-]{1,40}$/i.test(value) ? value : undefined;
}

function digestProviderMessageId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function buildDeliveryReceipt(result: unknown): EmailDeliveryReceipt {
  const candidate = result && typeof result === 'object'
    ? result as { accepted?: unknown; rejected?: unknown; messageId?: unknown }
    : {};
  const rejected = Array.isArray(candidate.rejected) ? candidate.rejected : [];
  const accepted = Array.isArray(candidate.accepted) ? candidate.accepted : [];
  if (rejected.length > 0 || accepted.length === 0) {
    throw new EmailDeliveryError('recipient_rejected');
  }
  return {
    acceptedAt: new Date(),
    providerMessageIdDigest: digestProviderMessageId(candidate.messageId),
  };
}

function isRecipientRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: unknown;
    command?: unknown;
    rejected?: unknown;
  };
  if (Array.isArray(candidate.rejected) && candidate.rejected.length > 0) return true;
  return String(candidate.code ?? '').toUpperCase() === 'EENVELOPE'
    && String(candidate.command ?? '').toUpperCase() === 'RCPT TO';
}

function normalizeDeliveryError(error: unknown): EmailDeliveryError {
  if (error instanceof EmailDeliveryError) return error;
  return new EmailDeliveryError(
    isRecipientRejection(error) ? 'recipient_rejected' : 'transport_unavailable',
    resolveProviderCode(error)
  );
}

export class EmailService {
  private transporter: EmailTransport | null = null;
  private readiness: EmailDeliveryReadiness;

  constructor(
    private readonly config: EmailDeliveryConfig = env.EMAIL_DELIVERY,
    transportFactory: TransportFactory = nodemailer.createTransport,
    resendTransportFactory: ResendTransportFactory = createResendApiTransport
  ) {
    this.readiness = {
      mode: config.mode,
      status: config.mode === 'disabled' ? 'disabled' : 'pending',
    };

    if (config.mode === 'smtp' && config.smtp) {
      const auth = config.smtp.user && config.smtp.pass
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined;
      this.transporter = transportFactory({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        requireTLS: config.smtp.requireTls,
        auth,
        connectionTimeout: config.transportVerifyTimeoutMs,
        greetingTimeout: config.transportVerifyTimeoutMs,
        socketTimeout: config.transportVerifyTimeoutMs,
      }) as unknown as EmailTransport;
    } else if (config.mode === 'resend_api' && config.resendApi) {
      this.transporter = resendTransportFactory(
        config.resendApi.apiKey,
        config.resendApi.baseUrl,
        config.transportVerifyTimeoutMs
      );
    }
  }

  private markDeliveryUnavailable(reason: EmailDeliveryFailureReason): void {
    if (this.config.mode === 'disabled' || reason === 'recipient_rejected') return;
    this.readiness = {
      ...this.readiness,
      mode: this.config.mode,
      status: 'unavailable',
    };
  }

  private markProviderAccepted(acceptedAt: Date): void {
    if (this.config.mode === 'disabled') return;
    this.readiness = {
      ...this.readiness,
      mode: this.config.mode,
      status: 'ready',
      lastAcceptedAt: acceptedAt.toISOString(),
    };
  }

  async initialize(): Promise<void> {
    if (this.config.mode === 'disabled') {
      logger.info('Email delivery disabled', { deliveryMode: 'disabled' });
      return;
    }
    if (!this.transporter) {
      this.markDeliveryUnavailable('not_configured');
      throw new EmailDeliveryError('not_configured');
    }

    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.transporter.verify(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new EmailDeliveryError('transport_unavailable', 'TIMEOUT')),
            this.config.transportVerifyTimeoutMs
          );
        }),
      ]);
      const verifiedAt = new Date().toISOString();
      this.readiness = {
        ...this.readiness,
        mode: this.config.mode,
        status: 'ready',
        verifiedAt,
      };
      logger.info('Email transport verified', { deliveryMode: this.config.mode });
    } catch (error) {
      const providerCode = error instanceof EmailDeliveryError
        ? error.providerCode
        : resolveProviderCode(error);
      this.markDeliveryUnavailable('transport_unavailable');
      logger.error('Email transport verification failed', {
        deliveryMode: this.config.mode,
        providerCode,
      });
      throw error instanceof EmailDeliveryError
        ? error
        : new EmailDeliveryError('transport_unavailable', providerCode);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  getReadiness(): EmailDeliveryReadiness {
    return { ...this.readiness };
  }

  /**
   * 發送驗證碼郵件
   */
  private sanitizeEmail(email: string): string {
    return email.replace(/[\r\n\x00-\x1f]/g, '');
  }

  async sendVerificationCode(
    email: string,
    code: string,
    type: VerificationEmailType,
    locale: BackendLocale = 'zh-TW'
  ): Promise<EmailDeliveryReceipt> {
    if (!this.transporter) {
      this.markDeliveryUnavailable('not_configured');
      logger.error('Verification email delivery unavailable', {
        purpose: type,
        reason: 'not_configured',
      });
      throw new EmailDeliveryError('not_configured');
    }

    email = this.sanitizeEmail(email);

    const copy = EMAIL_COPY[resolveEmailLocale(locale)];
    const verificationCopy = copy.verification[type];
    const text = verificationCopy.text(code);

    const fromAddr = this.config.from;
    if (!fromAddr) {
      this.markDeliveryUnavailable('not_configured');
      logger.error('Verification email delivery unavailable', {
        purpose: type,
        reason: 'not_configured',
      });
      throw new EmailDeliveryError('not_configured');
    }
    try {
      const result = await this.transporter.sendMail({
        from: `"${copy.fromName}" <${fromAddr}>`,
        to: email,
        subject: verificationCopy.subject,
        text,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${verificationCopy.subject}</h2>
            <p style="font-size: 16px; color: #666;">${text}</p>
            <p style="font-size: 14px; color: #999; margin-top: 20px;">
              ${copy.noRequestNotice}
            </p>
          </div>
        `,
      });

      const receipt = buildDeliveryReceipt(result);
      this.markProviderAccepted(receipt.acceptedAt);
      logger.info('Verification email accepted', { purpose: type });
      return receipt;
    } catch (error) {
      const deliveryError = normalizeDeliveryError(error);
      this.markDeliveryUnavailable(deliveryError.reason);
      logger.error('Verification email delivery failed', {
        purpose: type,
        reason: deliveryError.reason,
        providerCode: deliveryError.providerCode,
      });
      throw deliveryError;
    }
  }

  async sendProviderCanary(recipient: string, releaseRef: string): Promise<EmailDeliveryReceipt> {
    if (!this.transporter || !this.config.from) {
      this.markDeliveryUnavailable('not_configured');
      throw new EmailDeliveryError('not_configured');
    }

    const safeRecipient = this.sanitizeEmail(recipient);
    const safeReleaseRef = releaseRef.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'unknown';

    try {
      const result = await this.transporter.sendMail({
        from: `"Emorapy" <${this.config.from}>`,
        to: safeRecipient,
        subject: `Emorapy email delivery canary ${safeReleaseRef}`,
        text: `This is an explicit Emorapy provider-acceptance canary for release ${safeReleaseRef}.`,
      });

      const receipt = buildDeliveryReceipt(result);
      this.markProviderAccepted(receipt.acceptedAt);
      logger.info('Email provider canary accepted', {
        purpose: 'provider_canary',
        releaseRef: safeReleaseRef,
      });
      return receipt;
    } catch (error) {
      const deliveryError = normalizeDeliveryError(error);
      this.markDeliveryUnavailable(deliveryError.reason);
      logger.error('Email provider canary failed', {
        purpose: 'provider_canary',
        releaseRef: safeReleaseRef,
        reason: deliveryError.reason,
        providerCode: deliveryError.providerCode,
      });
      throw deliveryError;
    }
  }

  /**
   * 發送配對通知郵件
   */
  async sendPairingNotification(userId1: string, userId2: string): Promise<void> {
    if (!this.transporter) {
      this.markDeliveryUnavailable('not_configured');
      logger.warn('Notification email skipped', { purpose: 'pairing', reason: 'not_configured' });
      return;
    }

    let deliveryAttempted = false;
    try {
      const prisma = (await import('../config/database')).default;
      const users = await prisma.user.findMany({
        where: { id: { in: [userId1, userId2] } },
        select: { email: true, nickname: true, language: true },
      });
      const fromAddr = this.config.from;
      if (!fromAddr) {
        this.markDeliveryUnavailable('not_configured');
        return;
      }
      for (const u of users) {
        if (!u.email) continue;
        const copy = EMAIL_COPY[localeFromUserLanguage(u.language)];
        const safeEmail = this.sanitizeEmail(u.email);
        deliveryAttempted = true;
        const result = await this.transporter.sendMail({
          from: `"${copy.fromName}" <${fromAddr}>`,
          to: safeEmail,
          subject: copy.pairing.subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${copy.pairing.heading}</h2>
              <p style="font-size: 16px; color: #666;">${copy.pairing.body}</p>
            </div>
          `,
        });
        const receipt = buildDeliveryReceipt(result);
        this.markProviderAccepted(receipt.acceptedAt);
        deliveryAttempted = false;
      }
      logger.info('Notification email accepted', { purpose: 'pairing' });
    } catch (error) {
      const deliveryError = normalizeDeliveryError(error);
      if (deliveryAttempted) this.markDeliveryUnavailable(deliveryError.reason);
      logger.error('Notification email delivery failed', {
        purpose: 'pairing',
        providerCode: deliveryError.providerCode,
      });
    }
  }

  /**
   * 發送梳理結果通知郵件
   */
  async sendJudgmentNotification(userId: string, caseId: string): Promise<void> {
    if (!this.transporter) {
      this.markDeliveryUnavailable('not_configured');
      logger.warn('Notification email skipped', { purpose: 'analysis_ready', reason: 'not_configured' });
      return;
    }

    let deliveryAttempted = false;
    try {
      const prisma = (await import('../config/database')).default;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, nickname: true, language: true },
      });
      if (!user?.email) return;
      const fromAddr = this.config.from;
      if (!fromAddr) {
        this.markDeliveryUnavailable('not_configured');
        return;
      }
      const copy = EMAIL_COPY[localeFromUserLanguage(user.language)];
      const safeEmail = this.sanitizeEmail(user.email);
      deliveryAttempted = true;
      const result = await this.transporter.sendMail({
        from: `"${copy.fromName}" <${fromAddr}>`,
        to: safeEmail,
        subject: copy.analysisReady.subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${copy.analysisReady.heading}</h2>
            <p style="font-size: 16px; color: #666;">${copy.analysisReady.body}</p>
          </div>
        `,
      });
      const receipt = buildDeliveryReceipt(result);
      this.markProviderAccepted(receipt.acceptedAt);
      deliveryAttempted = false;
      logger.info('Notification email accepted', { purpose: 'analysis_ready' });
    } catch (error) {
      const deliveryError = normalizeDeliveryError(error);
      if (deliveryAttempted) this.markDeliveryUnavailable(deliveryError.reason);
      logger.error('Notification email delivery failed', {
        purpose: 'analysis_ready',
        providerCode: deliveryError.providerCode,
      });
    }
  }
}

export const emailService = new EmailService();
