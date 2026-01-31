import { Request, Response, NextFunction } from 'express';
import { caseService } from '../services/case.service';
import { judgmentService } from '../services/judgment.service';
import logger from '../config/logger';
import { Errors } from '../utils/errors';
import { getAuthUserId, getAuthUserIdOptional } from '../utils/request';

export class CaseController {
  /**
   * 創建案件（快速體驗模式）
   */
  async createQuickCase(req: Request, res: Response, next: NextFunction) {
    try {
      // 只提取Session ID，不創建（由服務層統一處理）
      const sessionId = (req.headers['x-session-id'] as string) || 
                        (req.query.session_id as string) ||
                        null; // 允許為null，由服務層處理

      // 傳遞給服務層，服務層會統一處理Session創建和驗證
      const result = await caseService.createQuickCase(req.body, sessionId);
      
      const case_ = result.case;
      const finalSessionId = result.sessionId; // 服務層返回的最終Session ID
      const sessionExpiresAt = result.sessionExpiresAt || null;

      // 異步觸發判決生成
      judgmentService.generateJudgment(case_.id, { sessionId: finalSessionId }).catch(err => {
        logger.error('Failed to generate judgment', { caseId: case_.id, error: err });
      });

      res.status(201).json({
        success: true,
        data: {
            case: case_,
          session_id: finalSessionId, // 返回最終Session ID
          session_expires_at: sessionExpiresAt ? sessionExpiresAt.toISOString() : undefined,
        },
        message: '案件已提交，AI正在分析中...',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 創建案件（完整模式）
   */
  async createCase(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const case_ = await caseService.createCase(userId, req.body);

      // 異步觸發判決生成
      judgmentService.generateJudgment(case_.id, { userId }).catch(err => {
        logger.error('Failed to generate judgment', { caseId: case_.id, error: err });
      });

      res.status(201).json({
        success: true,
        data: { case: case_ },
        message: '案件已提交',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 獲取案件詳情
   */
  async getCaseById(req: Request, res: Response, next: NextFunction) {
    try {
      const caseId = req.params.id;
      const userId = getAuthUserIdOptional(req);
      const sessionId = (req.query.session_id as string) || 
                        (req.headers['x-session-id'] as string);

      const case_ = await caseService.getCaseById(caseId, userId, sessionId);

      res.json({
        success: true,
        data: { case: case_ },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 通過Session ID獲取案件（快速體驗模式）
   */
  async getCaseBySessionId(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = (req.query.session_id as string) || 
                        (req.headers['x-session-id'] as string);

      if (!sessionId) {
        throw Errors.SESSION_ID_REQUIRED();
      }

      const case_ = await caseService.getCaseBySessionId(sessionId);

      if (!case_) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '案件不存在',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: { case: case_ },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 通過案件ID獲取判決（快速體驗模式和完整模式）
   */
  async getJudgmentByCaseId(req: Request, res: Response, next: NextFunction) {
    try {
      const caseId = req.params.id;
      const userId = getAuthUserIdOptional(req);
      const sessionId = (req.query.session_id as string) || 
                        (req.headers['x-session-id'] as string);

      const judgment = await judgmentService.getJudgmentByCaseId(
        caseId,
        userId,
        sessionId
      );

      if (!judgment) {
        res.status(202).json({
          success: false,
          error: {
            code: 'JUDGMENT_PENDING',
            message: '判決生成中，請稍後再試',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: { judgment },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 獲取案件列表（完整模式）
   */
  async getCaseList(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserId(req);
      const params = {
        status: req.query.status as string,
        type: req.query.type as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        page_size: req.query.page_size ? parseInt(req.query.page_size as string, 10) : undefined,
        sort_by: req.query.sort_by as string,
        sort_order: req.query.sort_order as 'asc' | 'desc',
        search: req.query.search as string,
      };

      const result = await caseService.getCaseList(userId, params);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 提交案件（將狀態從draft改為submitted）
   */
  async submitCase(req: Request, res: Response, next: NextFunction) {
    try {
      const caseId = req.params.id;
      const userId = getAuthUserId(req);

      const case_ = await caseService.submitCase(caseId, userId);

      // 異步觸發判決生成
      judgmentService.generateJudgment(case_.id, { userId }).catch(err => {
        logger.error('Failed to generate judgment', { caseId: case_.id, error: err });
      });

      res.json({
        success: true,
        data: { case: case_ },
        message: '案件已提交，AI正在分析中...',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新案件（僅draft狀態可更新）
   */
  async updateCase(req: Request, res: Response, next: NextFunction) {
    try {
      const caseId = req.params.id;
      const userId = getAuthUserId(req);

      const case_ = await caseService.updateCase(caseId, userId, req.body);

      res.json({
        success: true,
        data: { case: case_ },
        message: '案件已更新',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const caseController = new CaseController();
