import { Router, Request, Response, NextFunction } from 'express';
import { caseController } from '../controllers/case.controller';
import { evidenceController, deleteEvidence } from '../controllers/evidence.controller';
import { authenticate, optionalAuthenticate, validateSession } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { quickCaseSchema, createCaseSchema, uuidParamSchema, uuidEvidenceParamSchema } from '../utils/validation';
import { generalLimiter, uploadLimiter } from '../middleware/rateLimiter';

/**
 * UUID 預檢查中間件
 * 用於防止參數路由匹配錯誤的路徑（如 /quick 被 /:id 匹配）
 */
const validateUuidParam = (req: Request, res: Response, next: NextFunction): void => {
  const id = req.params.id;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !uuidPattern.test(id)) {
    // 如果不是 UUID，說明路由匹配錯誤，跳過此路由
    return next('route');
  }
  next();
};

const router = Router();

/**
 * 重要：路由順序非常關鍵！
 * Express 按照路由註冊順序匹配，具體路徑必須在參數路由之前
 * 
 * 路由匹配順序：
 * 1. 具體路徑（如 /quick, /by-session）- 必須在最前面
 * 2. 根路徑（如 /）- 在具體路徑之後
 * 3. 參數路由（如 /:id, /:id/evidence）- 必須在最後
 */

/**
 * @route   GET /api/v1/cases/by-session
 * @desc    通過Session ID獲取案件（快速體驗模式）
 * @access  Public
 */
router.get(
  '/by-session',
  generalLimiter,
  validateSession,
  caseController.getCaseBySessionId.bind(caseController)
);

/**
 * @route   POST /api/v1/cases/quick
 * @desc    創建案件（快速體驗模式）
 * @access  Public (可選認證)
 */
router.post(
  '/quick',
  generalLimiter,
  optionalAuthenticate,
  validate(quickCaseSchema),
  caseController.createQuickCase.bind(caseController)
);

/**
 * @route   POST /api/v1/cases
 * @desc    創建案件（完整模式）
 * @access  Private
 */
router.post(
  '/',
  generalLimiter,
  authenticate,
  validate(createCaseSchema),
  caseController.createCase.bind(caseController)
);

/**
 * @route   GET /api/v1/cases
 * @desc    獲取案件列表（完整模式）
 * @access  Private
 */
router.get(
  '/',
  generalLimiter,
  authenticate,
  caseController.getCaseList.bind(caseController)
);

/**
 * @route   POST /api/v1/cases/:id/evidence
 * @desc    上傳證據
 * @access  Private/Public (快速體驗模式)
 * @note    使用 validateUuidParam 中間件先驗證 id 是 UUID，避免匹配錯誤的路徑
 */
router.post(
  '/:id/evidence',
  uploadLimiter,
  optionalAuthenticate,
  validateUuidParam,
  validate(uuidParamSchema),
  evidenceController.uploadEvidence
);

/**
 * @route   DELETE /api/v1/cases/:id/evidence/:evidenceId
 * @desc    刪除證據
 * @access  Private/Public (快速體驗模式)
 */
router.delete(
  '/:id/evidence/:evidenceId',
  generalLimiter,
  optionalAuthenticate,
  validateUuidParam,
  validate(uuidEvidenceParamSchema),
  deleteEvidence
);

/**
 * @route   GET /api/v1/cases/:id/judgment
 * @desc    通過案件ID獲取判決（快速體驗模式和完整模式）
 * @access  Private/Public (快速體驗模式)
 */
router.get(
  '/:id/judgment',
  generalLimiter,
  optionalAuthenticate,
  validateUuidParam,
  validate(uuidParamSchema),
  caseController.getJudgmentByCaseId.bind(caseController)
);

/**
 * @route   POST /api/v1/cases/:id/submit
 * @desc    提交案件（將狀態從draft改為submitted）
 * @access  Private
 */
router.post(
  '/:id/submit',
  generalLimiter,
  authenticate,
  validateUuidParam,
  validate(uuidParamSchema),
  caseController.submitCase.bind(caseController)
);

/**
 * @route   PUT /api/v1/cases/:id
 * @desc    更新案件（僅draft狀態可更新）
 * @access  Private
 */
router.put(
  '/:id',
  generalLimiter,
  authenticate,
  validateUuidParam,
  validate(uuidParamSchema),
  caseController.updateCase.bind(caseController)
);

/**
 * @route   GET /api/v1/cases/:id
 * @desc    獲取案件詳情
 * @access  Private/Public (快速體驗模式)
 * @note    必須在所有具體路徑和參數路由之後定義
 */
router.get(
  '/:id',
  generalLimiter,
  optionalAuthenticate,
  validateUuidParam,
  validate(uuidParamSchema),
  caseController.getCaseById.bind(caseController)
);

export default router;
