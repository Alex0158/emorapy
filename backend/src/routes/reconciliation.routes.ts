import { Router } from 'express';
import { reconciliationController } from '../controllers/reconciliation.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { uuidParamSchema, generateReconciliationPlansSchema, selectPlanSchema } from '../utils/validation';
import { aiLimiter, generalLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /api/v1/judgments/:id/reconciliation-plans
 * @desc    生成和好方案
 * @access  Private
 */
router.post(
  '/judgments/:id/reconciliation-plans',
  aiLimiter,
  authenticate,
  validate({ ...uuidParamSchema, ...generateReconciliationPlansSchema }),
  reconciliationController.generatePlans.bind(reconciliationController)
);

/**
 * @route   GET /api/v1/judgments/:id/reconciliation-plans
 * @desc    獲取和好方案列表
 * @access  Private
 */
router.get(
  '/judgments/:id/reconciliation-plans',
  generalLimiter,
  authenticate,
  validate(uuidParamSchema),
  reconciliationController.getPlans.bind(reconciliationController)
);

/**
 * @route   GET /api/v1/reconciliation-plans/:id
 * @desc    獲取和好方案詳情
 * @access  Private
 */
router.get(
  '/reconciliation-plans/:id',
  generalLimiter,
  authenticate,
  validate(uuidParamSchema),
  reconciliationController.getPlanById.bind(reconciliationController)
);

/**
 * @route   POST /api/v1/reconciliation-plans/:id/select
 * @desc    選擇和好方案
 * @access  Private
 */
router.post(
  '/reconciliation-plans/:id/select',
  generalLimiter,
  authenticate,
  validate({ ...uuidParamSchema, ...selectPlanSchema }),
  reconciliationController.selectPlan.bind(reconciliationController)
);

export default router;

