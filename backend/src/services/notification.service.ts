import prisma from '../config/database';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

export class NotificationService {
  async list(userId: string, status?: NotificationStatus) {
    const where: any = { user_id: userId };
    if (status) where.status = status;
    return prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async create(userId: string, data: { template_code: string; payload?: any; channel: NotificationChannel; dedup_key?: string }) {
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
}

export const notificationService = new NotificationService();
