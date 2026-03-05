import nodemailer from 'nodemailer';
import { env } from '../config/env';
import logger from '../config/logger';

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
    type: 'register' | 'reset_password' | 'verify_email'
  ): Promise<void> {
    if (!this.transporter) {
      logger.warn('郵件服務未配置，跳過發送', { email, code, type });
      return;
    }

    email = this.sanitizeEmail(email);

    const subjectMap = {
      register: '歡迎註冊 CJ 平台 - 請驗證您的郵箱',
      reset_password: '重置密碼 - CJ 平台',
      verify_email: '驗證郵箱 - CJ 平台',
    };

    const contentMap = {
      register: `您的驗證碼是：${code}，有效期5分鐘。`,
      reset_password: `您的重置密碼驗證碼是：${code}，有效期5分鐘。`,
      verify_email: `您的驗證碼是：${code}，有效期5分鐘。`,
    };

    try {
      await this.transporter.sendMail({
        from: `"CJ 平台" <${env.SMTP_USER}>`,
        to: email,
        subject: subjectMap[type],
        text: contentMap[type],
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subjectMap[type]}</h2>
            <p style="font-size: 16px; color: #666;">${contentMap[type]}</p>
            <p style="font-size: 14px; color: #999; margin-top: 20px;">
              如果您沒有請求此驗證碼，請忽略此郵件。
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
        select: { email: true, nickname: true },
      });
      const subject = '配對成功通知 - CJ 平台';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">配對成功</h2>
          <p style="font-size: 16px; color: #666;">你們的配對已生效，現在可以創建案件並獲取判決。</p>
        </div>
      `;
      for (const u of users) {
        if (!u.email) continue;
        const safeEmail = this.sanitizeEmail(u.email);
        await this.transporter.sendMail({
          from: `"CJ 平台" <${env.SMTP_USER}>`,
          to: safeEmail,
          subject,
          html,
        });
      }
      logger.info('Pairing notification sent', { userId1, userId2 });
    } catch (error) {
      logger.error('Failed to send pairing notification', { userId1, userId2, error });
    }
  }

  /**
   * 發送判決通知郵件
   */
  async sendJudgmentNotification(userId: string, caseId: string): Promise<void> {
    if (!this.transporter) {
      logger.warn('郵件服務未配置，跳過判決通知', { userId, caseId });
      return;
    }

    try {
      const prisma = (await import('../config/database')).default;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, nickname: true },
      });
      if (!user?.email) return;
      const safeEmail = this.sanitizeEmail(user.email);
      const subject = '判決完成通知 - CJ 平台';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">判決已生成</h2>
          <p style="font-size: 16px; color: #666;">您提交的案件判決已生成，請登錄查看詳細內容。</p>
        </div>
      `;
      await this.transporter.sendMail({
        from: `"CJ 平台" <${env.SMTP_USER}>`,
        to: safeEmail,
        subject,
        html,
      });
      logger.info('Judgment notification sent', { userId, caseId });
    } catch (error) {
      logger.error('Failed to send judgment notification', { userId, caseId, error });
    }
  }
}

export const emailService = new EmailService();
