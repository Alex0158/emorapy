import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validator';
import {
  registerSchema,
  loginSchema,
  sendVerificationCodeSchema,
  verifyEmailSchema,
  resetPasswordSchema,
  confirmResetPasswordSchema,
} from '../utils/validation';
import {
  registerLimiter,
  authLimiter,
  verificationCodeLimiter,
} from '../middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    用戶註冊
 * @access  Public
 */
router.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  authController.register.bind(authController)
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    用戶登錄
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login.bind(authController)
);

/**
 * @route   POST /api/v1/auth/send-verification-code
 * @desc    發送驗證碼
 * @access  Public
 */
router.post(
  '/send-verification-code',
  verificationCodeLimiter,
  validate(sendVerificationCodeSchema),
  authController.sendVerificationCode.bind(authController)
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    驗證郵件驗證碼
 * @access  Public
 */
router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  authController.verifyEmail.bind(authController)
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    重置密碼
 * @access  Public
 */
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword.bind(authController)
);

/**
 * @route   POST /api/v1/auth/reset-password-confirm
 * @desc    確認重置密碼
 * @access  Public
 */
router.post(
  '/reset-password-confirm',
  validate(confirmResetPasswordSchema),
  authController.confirmResetPassword.bind(authController)
);

export default router;

