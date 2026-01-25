import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

router.get('/notifications', authenticate, notificationController.list.bind(notificationController));
router.post('/notifications', authenticate, notificationController.create.bind(notificationController));

export default router;
