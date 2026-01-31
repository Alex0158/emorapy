import { Router } from 'express';
import { executionController } from '../controllers/execution.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import {
  confirmExecutionSchema,
  checkinSchema,
  executionStatusQuerySchema,
} from '../utils/validation';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /api/v1/execution/confirm
 * @desc    確認執行
 * @access  Private
 */
router.post(
  '/confirm',
  generalLimiter,
  authenticate,
  validate(confirmExecutionSchema),
  executionController.confirmExecution.bind(executionController)
);

/**
 * @route   POST /api/v1/execution/checkin
 * @desc    執行打卡
 * @access  Private
 */
router.post(
  '/checkin',
  generalLimiter,
  authenticate,
  validate(checkinSchema),
  executionController.checkin.bind(executionController)
);

/**
 * @route   GET /api/v1/execution/status
 * @desc    獲取執行狀態
 * @access  Private
 */
router.get(
  '/status',
  generalLimiter,
  authenticate,
  validate(executionStatusQuerySchema),
  executionController.getExecutionStatus.bind(executionController)
);

/**
 * @route   GET /api/v1/execution/dashboard
 * @desc    獲取所有執行狀態（用於執行看板）
 * @access  Private
 */
router.get(
  '/dashboard',
  generalLimiter,
  authenticate,
  executionController.getAllExecutionStatuses.bind(executionController)
);

export default router;

