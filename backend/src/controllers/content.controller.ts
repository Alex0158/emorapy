import { Request, Response, NextFunction } from 'express';
import { contentService } from '../services/content.service';
import { caseService } from '../services/case.service';
import { Errors } from '../utils/errors';
import { getSessionIdFromSources, getAuthUserIdOptional } from '../utils/request';

const ALLOWED_CONTENT_RELATIONS = new Set(['recommend', 'similar', 'waiting']);
const MAX_CONTENT_LIMIT = 100;

export class ContentController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const tags = (req.query.tags as string)?.split(',').filter(Boolean);
      const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const limit = Math.min(MAX_CONTENT_LIMIT, Math.max(1, rawLimit || 20));
      const items = await contentService.listContent({
        type: req.query.type as string,
        tags,
        language: req.query.language as string,
        is_active: req.query.is_active ? req.query.is_active === 'true' : true,
        limit,
      });
      res.json({ success: true, data: { items } });
    } catch (error) {
      next(error);
    }
  }

  async recommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { caseId } = req.params;
      const userId = getAuthUserIdOptional(req);
      const { sessionId } = getSessionIdFromSources(req);
      await caseService.getCaseById(caseId, userId, sessionId || undefined);
      const relation = (req.query.relation as string) || 'recommend';
      const items = await contentService.getRecommendations(caseId, relation);
      res.json({ success: true, data: { items } });
    } catch (error) {
      next(error);
    }
  }

  async link(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getAuthUserIdOptional(req);
      if (!userId) {
        throw Errors.UNAUTHORIZED('需要認證');
      }
      const { case_id, content_id } = req.body;
      const relation = (req.body.relation as string) || 'recommend';
      if (!case_id || !content_id) {
        throw Errors.VALIDATION_ERROR('case_id、content_id 為必填');
      }
      if (!ALLOWED_CONTENT_RELATIONS.has(relation)) {
        throw Errors.VALIDATION_ERROR(`relation 只能是 ${Array.from(ALLOWED_CONTENT_RELATIONS).join(', ')}`);
      }
      await caseService.getCaseById(case_id, userId);
      const link = await contentService.linkContent(case_id, content_id, relation);
      res.json({ success: true, data: { link }, message: '已關聯內容' });
    } catch (error) {
      next(error);
    }
  }
}

export const contentController = new ContentController();
