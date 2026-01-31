import { Router } from 'express';
import { pairingService } from '../services/pairing.service';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { createPairingSchema, joinPairingSchema } from '../utils/validation';
import { generalLimiter } from '../middleware/rateLimiter';
import { getAuthUserId } from '../utils/request';

const router = Router();

/**
 * @route   POST /api/v1/pairing/create
 * @desc    創建配對（生成邀請碼）
 * @access  Private
 */
router.post(
  '/create',
  generalLimiter,
  authenticate,
  validate(createPairingSchema),
  async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const pairing = await pairingService.createPairing(userId);

      res.json({
        success: true,
        data: { pairing },
        message: '邀請碼已生成',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/pairing/join
 * @desc    加入配對（使用邀請碼）
 * @access  Private
 */
router.post(
  '/join',
  generalLimiter,
  authenticate,
  validate(joinPairingSchema),
  async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const pairing = await pairingService.joinPairing(userId, req.body.invite_code);

      res.json({
        success: true,
        data: { pairing },
        message: '配對成功',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/pairing/status
 * @desc    獲取配對狀態
 * @access  Private
 */
router.get(
  '/status',
  generalLimiter,
  authenticate,
  async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const pairing = await pairingService.getPairingStatus(userId);

      res.json({
        success: true,
        data: { pairing },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/pairing/cancel
 * @desc    解除配對
 * @access  Private
 */
router.post(
  '/cancel',
  generalLimiter,
  authenticate,
  async (req, res, next) => {
    try {
      const userId = getAuthUserId(req);
      const pairing = await pairingService.cancelPairing(userId);

      res.json({
        success: true,
        data: { pairing },
        message: '配對已解除',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
