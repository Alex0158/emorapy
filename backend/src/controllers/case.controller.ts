import { Request, Response, NextFunction } from 'express';
import { caseService } from '../services/case.service';
import { judgmentService } from '../services/judgment.service';
import logger from '../config/logger';
import { Errors } from '../utils/errors';
import { getAuthUserId, getAuthUserIdOptional, getSessionIdFromSources } from '../utils/request';
import { CASE_STATUS } from '../utils/constants';

function triggerJudgment(caseId: string, opts: { userId?: string; sessionId?: string | null }) {
  const { sessionId, ...rest } = opts;
  setImmediate(() => {
    judgmentService.generateJudgment(caseId, { ...rest, sessionId: sessionId ?? undefined }).catch(err => {
      logger.error('Async judgment generation failed', { caseId, error: err });
    });
  });
}

export class CaseController {
  /**
   * 創建案件（快速體驗模式）
   */
  async createQuickCase(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

      // 傳遞給服務層，服務層會統一處理Session創建和驗證
      const result = await caseService.createQuickCase(req.body, sessionId ?? null);
      
      const case_ = result.case;
      const finalSessionId = result.sessionId; // 服務層返回的最終Session ID
      const sessionExpiresAt = result.sessionExpiresAt || null;

      triggerJudgment(case_.id, { sessionId: finalSessionId });

      res.status(201).json({
        success: true,
        data: {
            case: case_,
          session_id: finalSessionId,
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

      if (case_.status === CASE_STATUS.SUBMITTED) {
        triggerJudgment(case_.id, { userId });
      }

      const isDraft = case_.status === CASE_STATUS.DRAFT;
      res.status(201).json({
        success: true,
        data: { case: case_ },
        message: isDraft ? '案件已建立，等待對方陳述' : '案件已提交',
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
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

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
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

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
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

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
            message: '分析生成中，請稍後再試',
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

      triggerJudgment(case_.id, { userId });

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

      if (case_.status === CASE_STATUS.SUBMITTED) {
        triggerJudgment(case_.id, { userId });
      }

      res.json({
        success: true,
        data: { case: case_ },
        message: case_.status === CASE_STATUS.SUBMITTED ? '雙方陳述已完成，AI正在分析中...' : '案件已更新',
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * 創建/更新協作聽證案件
   */
  async createCollaborativeCase(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, hasConflict } = getSessionIdFromSources(req);
      if (hasConflict) {
        throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
      }

      const result = await caseService.createOrUpdateCollaborativeCase(req.body, sessionId ?? null);

      if (result.phase === 'submitted') {
        triggerJudgment(result.case.id, { sessionId: result.sessionId });
      }

      res.status(result.phase === 'a_done' ? 201 : 200).json({
        success: true,
        data: {
          case: result.case,
          session_id: result.sessionId,
          session_expires_at: result.sessionExpiresAt.toISOString(),
          phase: result.phase,
        },
        message: result.phase === 'a_done' ? '角色A陳述已記錄，請將設備交給角色B' : '案件已提交，AI正在分析中...',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const caseController = new CaseController();
