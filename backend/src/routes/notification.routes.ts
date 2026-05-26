import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { notificationController } from '../controllers/notification.controller';
import { generalLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import {
  createNotificationSchema,
  notificationActSchema,
  notificationIdParamSchema,
  notificationListQuerySchema,
  notificationSnoozeSchema,
  pushDeviceTokenRegistrationSchema,
  pushDeviceTokenRevokeSchema,
} from '../utils/validation';

const router = Router();

router.get(
  '/notifications',
  generalLimiter,
  authenticate,
  validate(notificationListQuerySchema),
  notificationController.list.bind(notificationController)
);

router.get(
  '/notifications/unread-count',
  generalLimiter,
  authenticate,
  notificationController.unreadCount.bind(notificationController)
);

router.post(
  '/notifications',
  generalLimiter,
  authenticate,
  validate(createNotificationSchema),
  notificationController.create.bind(notificationController)
);

router.post(
  '/notifications/read-all',
  generalLimiter,
  authenticate,
  notificationController.markAllRead.bind(notificationController)
);

router.post(
  '/notifications/device-tokens',
  generalLimiter,
  authenticate,
  validate(pushDeviceTokenRegistrationSchema),
  notificationController.registerDeviceToken.bind(notificationController)
);

router.post(
  '/notifications/device-tokens/revoke',
  generalLimiter,
  authenticate,
  validate(pushDeviceTokenRevokeSchema),
  notificationController.revokeDeviceToken.bind(notificationController)
);

router.post(
  '/notifications/:id/read',
  generalLimiter,
  authenticate,
  validate(notificationIdParamSchema),
  notificationController.markRead.bind(notificationController)
);

router.post(
  '/notifications/:id/dismiss',
  generalLimiter,
  authenticate,
  validate(notificationIdParamSchema),
  notificationController.dismiss.bind(notificationController)
);

router.post(
  '/notifications/:id/snooze',
  generalLimiter,
  authenticate,
  validate({ ...notificationIdParamSchema, ...notificationSnoozeSchema }),
  notificationController.snooze.bind(notificationController)
);

router.post(
  '/notifications/:id/act',
  generalLimiter,
  authenticate,
  validate({ ...notificationIdParamSchema, ...notificationActSchema }),
  notificationController.act.bind(notificationController)
);

export default router;
