import { Router } from 'express';
import { interviewController } from '../controllers/interview.controller';
import { authenticate } from '../middleware/auth';
import { requireConsent } from '../middleware/consent';
import { validate } from '../middleware/validator';
import { uuidParamSchema, interviewStartSchema, interviewRespondSchema } from '../utils/validation';
import { interviewStartLimiter, interviewRespondLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post(
  '/start',
  authenticate,
  requireConsent,
  interviewStartLimiter,
  validate(interviewStartSchema),
  interviewController.startSession.bind(interviewController)
);

router.post(
  '/:id/respond',
  authenticate,
  requireConsent,
  interviewRespondLimiter,
  validate(uuidParamSchema),
  validate(interviewRespondSchema),
  interviewController.respond.bind(interviewController)
);

router.post(
  '/:id/end',
  authenticate,
  requireConsent,
  validate(uuidParamSchema),
  interviewController.endSession.bind(interviewController)
);

router.post(
  '/:id/skip',
  authenticate,
  requireConsent,
  interviewRespondLimiter,
  validate(uuidParamSchema),
  interviewController.skip.bind(interviewController)
);

router.get(
  '/resume',
  authenticate,
  requireConsent,
  interviewController.checkResume.bind(interviewController)
);

router.get(
  '/:id',
  authenticate,
  requireConsent,
  validate(uuidParamSchema),
  interviewController.getSession.bind(interviewController)
);

router.post(
  '/:id/retry',
  authenticate,
  requireConsent,
  validate(uuidParamSchema),
  interviewController.retryFailed.bind(interviewController)
);

export default router;
