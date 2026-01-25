import { Router } from 'express';
import { userController, uploadAvatar } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import { updateProfileSchema } from '../utils/validation';

const router = Router();

/**
 * @route   GET /api/v1/user/profile
 * @desc    獲取用戶資料
 * @access  Private
 */
router.get(
  '/profile',
  generalLimiter,
  authenticate,
  userController.getProfile.bind(userController)
);

/**
 * @route   PUT /api/v1/user/profile
 * @desc    更新用戶資料
 * @access  Private
 */
router.put(
  '/profile',
  generalLimiter,
  authenticate,
  validate(updateProfileSchema),
  userController.updateProfile.bind(userController)
);

/**
 * @route   POST /api/v1/user/avatar
 * @desc    上傳並更新頭像
 * @access  Private
 */
router.post(
  '/avatar',
  generalLimiter,
  authenticate,
  ...uploadAvatar
);

export default router;
