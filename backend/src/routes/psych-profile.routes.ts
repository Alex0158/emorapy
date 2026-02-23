import { Router } from 'express';
import { psychProfileController } from '../controllers/psych-profile.controller';
import { authenticate } from '../middleware/auth';
import { requireConsent } from '../middleware/consent';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get(
  '/',
  generalLimiter,
  authenticate,
  psychProfileController.getProfile.bind(psychProfileController)
);

router.get(
  '/feedback',
  generalLimiter,
  authenticate,
  requireConsent,
  psychProfileController.getFeedbackHistory.bind(psychProfileController)
);

router.post(
  '/consent',
  generalLimiter,
  authenticate,
  psychProfileController.giveConsent.bind(psychProfileController)
);

router.delete(
  '/',
  generalLimiter,
  authenticate,
  requireConsent,
  psychProfileController.deleteAllData.bind(psychProfileController)
);

export default router;
