import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { profileController } from '../controllers/profile.controller';

const router = Router();

// 個人背景
router.get('/profile/me', authenticate, profileController.getUserProfile.bind(profileController));
router.put('/profile/me', authenticate, profileController.upsertUserProfile.bind(profileController));

// 關係檔案（需配對成員）
router.get(
  '/profile/relationship/:pairingId',
  authenticate,
  profileController.getRelationshipProfile.bind(profileController)
);

router.put(
  '/profile/relationship/:pairingId',
  authenticate,
  profileController.upsertRelationshipProfile.bind(profileController)
);

export default router;
