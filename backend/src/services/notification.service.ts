import prisma from '../config/database';
import { Prisma, NotificationChannel, NotificationStatus } from '@prisma/client';
import logger from '../config/logger';

export class NotificationService {
  async list(userId: string, status?: NotificationStatus) {
    const where: Prisma.NotificationWhereInput = { user_id: userId };
    if (status) where.status = status;
    return prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async create(userId: string, data: { template_code: string; payload?: Prisma.InputJsonValue; channel: NotificationChannel; dedup_key?: string }) {
    return prisma.notification.create({
      data: {
        user_id: userId,
        template_code: data.template_code,
        payload: data.payload || {},
        channel: data.channel,
        dedup_key: data.dedup_key,
        status: NotificationStatus.pending,
      },
    });
  }

  async markAsSent(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.sent, sent_at: new Date() },
    });
  }

  async markFailed(id: string, errorMessage: string) {
    return prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.failed, error_message: errorMessage },
    });
  }

  async getPending(limit = 50) {
    return prisma.notification.findMany({
      where: { status: NotificationStatus.pending },
      orderBy: { created_at: 'asc' },
      take: limit,
      include: { user: { select: { email: true, notification_enabled: true } } },
    });
  }

  /**
   * 檢查使用者是否啟用通知；不存在或未啟用則回傳 false
   */
  async isNotificationEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notification_enabled: true },
    });
    return user?.notification_enabled ?? false;
  }

  /**
   * 為使用者建立通知記錄（內部使用），先檢查 notification_enabled
   */
  async createIfEnabled(userId: string, data: { template_code: string; payload?: Prisma.InputJsonValue; channel: NotificationChannel; dedup_key?: string }) {
    const enabled = await this.isNotificationEnabled(userId);
    if (!enabled) {
      logger.debug('Notification skipped (user disabled)', { userId, template: data.template_code });
      return null;
    }
    return this.create(userId, data);
  }
}

export const notificationService = new NotificationService();
