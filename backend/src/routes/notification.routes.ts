import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { notificationController } from '../controllers/notification.controller';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/notifications', generalLimiter, authenticate, notificationController.list.bind(notificationController));

export default router;
