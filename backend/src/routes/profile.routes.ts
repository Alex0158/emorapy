import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { pairingIdParamSchema, upsertUserProfileSchema, upsertRelationshipProfileSchema } from '../utils/validation';
import { profileController } from '../controllers/profile.controller';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// 個人背景
router.get('/profile/me', generalLimiter, authenticate, profileController.getUserProfile.bind(profileController));
router.put('/profile/me', generalLimiter, authenticate, validate(upsertUserProfileSchema), profileController.upsertUserProfile.bind(profileController));

// 關係檔案（需配對成員）
router.get(
  '/profile/relationship/:pairingId',
  generalLimiter,
  authenticate,
  validate(pairingIdParamSchema),
  profileController.getRelationshipProfile.bind(profileController)
);

router.put(
  '/profile/relationship/:pairingId',
  generalLimiter,
  authenticate,
  validate(pairingIdParamSchema),
  validate(upsertRelationshipProfileSchema),
  profileController.upsertRelationshipProfile.bind(profileController)
);

export default router;
