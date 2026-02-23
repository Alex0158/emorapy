import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { NotificationStatus, NotificationChannel } from '@prisma/client';
import { Errors } from '../utils/errors';
import { getAuthUserId } from '../utils/request';

const VALID_STATUSES = new Set(Object.values(NotificationStatus));
const VALID_CHANNELS = new Set(Object.values(NotificationChannel));

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const rawStatus = req.query.status as string | undefined;
      let status: NotificationStatus | undefined;
      if (rawStatus) {
        if (!VALID_STATUSES.has(rawStatus as NotificationStatus)) {
          throw Errors.VALIDATION_ERROR(`status 必須為 ${[...VALID_STATUSES].join(' / ')}`);
        }
        status = rawStatus as NotificationStatus;
      }
      const notifications = await notificationService.list(userId, status);
      res.json({ success: true, data: { notifications } });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const { channel, template_code, payload, dedup_key } = req.body;

      if (!channel || !VALID_CHANNELS.has(channel as NotificationChannel)) {
        throw Errors.VALIDATION_ERROR(`channel 必須為 ${[...VALID_CHANNELS].join(' / ')}`);
      }
      if (!template_code || typeof template_code !== 'string') {
        throw Errors.VALIDATION_ERROR('template_code 為必填欄位');
      }

      const notification = await notificationService.create(userId, {
        channel: channel as NotificationChannel,
        template_code,
        payload: typeof payload === 'object' && payload !== null ? payload : {},
        dedup_key: typeof dedup_key === 'string' ? dedup_key : undefined,
      });
      res.status(201).json({ success: true, data: { notification }, message: '通知已記錄' });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
