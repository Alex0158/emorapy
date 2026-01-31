import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { NotificationStatus, NotificationChannel } from '@prisma/client';
import { Errors } from '../utils/errors';
import { getAuthUserId } from '../utils/request';

const ALLOWED_CHANNELS = new Set(Object.values(NotificationChannel));

export class NotificationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const status = req.query.status as NotificationStatus | undefined;
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
      if (!channel || !ALLOWED_CHANNELS.has(channel)) {
        throw Errors.VALIDATION_ERROR('channel 必須為 email 或 push');
      }
      if (!template_code || typeof template_code !== 'string') {
        throw Errors.VALIDATION_ERROR('template_code 為必填字串');
      }
      const notification = await notificationService.create(userId, {
        channel,
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
