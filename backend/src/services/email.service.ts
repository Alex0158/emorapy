import nodemailer from 'nodemailer';
import { env } from '../config/env';
import logger from '../config/logger';
import type { BackendLocale } from '../i18n';

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
    fromName: 'CJ 平台',
    verification: {
      register: {
        subject: '歡迎註冊 CJ 平台 - 請驗證您的郵箱',
        text: (code) => `您的驗證碼是：${code}，有效期5分鐘。`,
      },
      reset_password: {
        subject: '重置密碼 - CJ 平台',
        text: (code) => `您的重置密碼驗證碼是：${code}，有效期5分鐘。`,
      },
      verify_email: {
        subject: '驗證郵箱 - CJ 平台',
        text: (code) => `您的驗證碼是：${code}，有效期5分鐘。`,
      },
    },
    noRequestNotice: '如果您沒有請求此驗證碼，請忽略此郵件。',
    pairing: {
      subject: '配對成功通知 - CJ 平台',
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
    fromName: 'CJ Platform',
    verification: {
      register: {
        subject: 'Welcome to CJ Platform - Verify your email',
        text: (code) => `Your verification code is ${code}. It expires in 5 minutes.`,
      },
      reset_password: {
        subject: 'Reset your password - CJ Platform',
        text: (code) => `Your password reset verification code is ${code}. It expires in 5 minutes.`,
      },
      verify_email: {
        subject: 'Verify your email - CJ Platform',
        text: (code) => `Your verification code is ${code}. It expires in 5 minutes.`,
      },
    },
    noRequestNotice: 'If you did not request this code, you can ignore this email.',
    pairing: {
      subject: 'Pairing confirmed - CJ Platform',
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

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    } else {
      logger.warn('郵件服務未配置，將跳過郵件發送');
    }
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
  ): Promise<void> {
    if (!this.transporter) {
      logger.warn('郵件服務未配置，跳過發送', { email, code, type });
      return;
    }

    email = this.sanitizeEmail(email);

    const copy = EMAIL_COPY[resolveEmailLocale(locale)];
    const verificationCopy = copy.verification[type];
    const text = verificationCopy.text(code);

    const fromAddr = env.EMAIL_FROM || env.SMTP_USER;
    if (!fromAddr) {
      logger.warn('未配置發件人地址（EMAIL_FROM 或 SMTP_USER），跳過發送', { email, type });
      return;
    }
    try {
      await this.transporter.sendMail({
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

      logger.info('Verification email sent', { email, type });
    } catch (error) {
      logger.error('Failed to send verification email', { email, type, error });
      throw error;
    }
  }

  /**
   * 發送配對通知郵件
   */
  async sendPairingNotification(userId1: string, userId2: string): Promise<void> {
    if (!this.transporter) {
      logger.warn('郵件服務未配置，跳過配對通知', { userId1, userId2 });
      return;
    }

    try {
      const prisma = (await import('../config/database')).default;
      const users = await prisma.user.findMany({
        where: { id: { in: [userId1, userId2] } },
        select: { email: true, nickname: true, language: true },
      });
      const fromAddr = env.EMAIL_FROM || env.SMTP_USER;
      if (!fromAddr) return;
      for (const u of users) {
        if (!u.email) continue;
        const copy = EMAIL_COPY[localeFromUserLanguage(u.language)];
        const safeEmail = this.sanitizeEmail(u.email);
        await this.transporter.sendMail({
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
      }
      logger.info('Pairing notification sent', { userId1, userId2 });
    } catch (error) {
      logger.error('Failed to send pairing notification', { userId1, userId2, error });
    }
  }

  /**
   * 發送梳理結果通知郵件
   */
  async sendJudgmentNotification(userId: string, caseId: string): Promise<void> {
    if (!this.transporter) {
      logger.warn('郵件服務未配置，跳過梳理結果通知', { userId, caseId });
      return;
    }

    try {
      const prisma = (await import('../config/database')).default;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, nickname: true, language: true },
      });
      if (!user?.email) return;
      const fromAddr = env.EMAIL_FROM || env.SMTP_USER;
      if (!fromAddr) return;
      const copy = EMAIL_COPY[localeFromUserLanguage(user.language)];
      const safeEmail = this.sanitizeEmail(user.email);
      await this.transporter.sendMail({
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
      logger.info('Analysis notification sent', { userId, caseId });
    } catch (error) {
      logger.error('Failed to send analysis notification', { userId, caseId, error });
    }
  }
}

export const emailService = new EmailService();
