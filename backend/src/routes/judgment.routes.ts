import { Router } from 'express';
import { judgmentController } from '../controllers/judgment.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { uuidParamSchema } from '../utils/validation';
import { aiLimiter, generalLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /api/v1/judgments/generate/:id
 * @desc    生成判決
 * @access  Private/Public (快速體驗模式)
 */
router.post(
  '/generate/:id',
  optionalAuthenticate,
  aiLimiter,
  validate(uuidParamSchema),
  judgmentController.generateJudgment.bind(judgmentController)
);

/**
 * @route   GET /api/v1/judgments/:id
 * @desc    獲取判決詳情
 * @access  Private/Public (快速體驗模式)
 */
router.get(
  '/:id',
  generalLimiter,
  optionalAuthenticate,
  validate(uuidParamSchema),
  judgmentController.getJudgmentById.bind(judgmentController)
);

/**
 * @route   POST /api/v1/judgments/:id/accept
 * @desc    接受/拒絕判決
 * @access  Private
 */
router.post(
  '/:id/accept',
  generalLimiter,
  authenticate,
  validate(uuidParamSchema),
  judgmentController.acceptJudgment.bind(judgmentController)
);

export default router;
