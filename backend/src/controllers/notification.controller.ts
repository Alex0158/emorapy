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
      const rawState = req.query.state as string | undefined;
      const templateCode = typeof req.query.template_code === 'string' ? req.query.template_code : undefined;
      const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      let status: NotificationStatus | undefined;
      if (rawStatus) {
        if (!VALID_STATUSES.has(rawStatus as NotificationStatus)) {
          throw Errors.VALIDATION_ERROR(`status 必須為 ${[...VALID_STATUSES].join(' / ')}`);
        }
        status = rawStatus as NotificationStatus;
      }
      const notifications = await notificationService.list(userId, {
        status,
        state: rawState as 'unread' | 'all' | 'actionable' | 'snoozed' | 'archived' | undefined,
        templateCode,
        limit,
        cursor,
      });
      res.json({ success: true, data: { notifications: notifications.items, next_cursor: notifications.nextCursor, has_more: notifications.hasMore } });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const { channel, template_code, payload, dedup_key, action_key, priority, group_key } = req.body;

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
        action_key: typeof action_key === 'string' ? action_key : undefined,
        priority: typeof priority === 'string' ? priority : undefined,
        group_key: typeof group_key === 'string' ? group_key : undefined,
      });
      res.status(201).json({ success: true, data: { notification }, message: '通知已記錄' });
    } catch (error) {
      next(error);
    }
  }

  async unreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const unread_count = await notificationService.getUnreadCount(userId);
      res.json({ success: true, data: { unread_count } });
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const notification = await notificationService.markRead(userId, req.params.id);
      if (!notification) {
        throw Errors.NOT_FOUND('通知不存在');
      }
      res.json({ success: true, data: { notification } });
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const result = await notificationService.markAllRead(userId);
      res.json({ success: true, data: result, message: '已將通知標記為已讀' });
    } catch (error) {
      next(error);
    }
  }

  async dismiss(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const notification = await notificationService.dismiss(userId, req.params.id);
      if (!notification) {
        throw Errors.NOT_FOUND('通知不存在');
      }
      res.json({ success: true, data: { notification }, message: '已封存這則通知' });
    } catch (error) {
      next(error);
    }
  }

  async snooze(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const hours = typeof req.body?.hours === 'number' ? req.body.hours : undefined;
      const notification = await notificationService.snooze(userId, req.params.id, hours);
      if (!notification) {
        throw Errors.NOT_FOUND('通知不存在');
      }
      res.json({ success: true, data: { notification }, message: '已稍後提醒這則通知' });
    } catch (error) {
      next(error);
    }
  }

  async act(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const actionKey = typeof req.body?.action_key === 'string' ? req.body.action_key : undefined;
      const result = await notificationService.act(userId, req.params.id, actionKey);
      if (!result) {
        throw Errors.NOT_FOUND('通知不存在');
      }
      res.json({ success: true, data: result, message: '已處理這則通知' });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
