/**
 * ContentController 單元測試（mock contentService、caseService、Errors）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { ContentController } from '../../../src/controllers/content.controller';
import { contentService } from '../../../src/services/content.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockListContent: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetRecommendations: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLinkContent: any = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetCaseById: any = jest.fn();

jest.mock('../../../src/services/content.service', () => ({
  contentService: {
    listContent: (opts: unknown) => mockListContent(opts),
    getRecommendations: (caseId: string, relation: string) =>
      mockGetRecommendations(caseId, relation),
    linkContent: (caseId: string, contentId: string, relation: string) =>
      mockLinkContent(caseId, contentId, relation),
  },
}));

jest.mock('../../../src/services/case.service', () => ({
  caseService: {
    getCaseById: (caseId: string, userId?: string | null, sessionId?: string | null) =>
      mockGetCaseById(caseId, userId, sessionId),
  },
}));

describe('ContentController', () => {
  let controller: ContentController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ContentController();
    req = {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: { id: 'u1', email: 'u1@test.com' },
    };
    res = { json: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
    mockGetCaseById.mockResolvedValue({ id: 'c1', plaintiff_id: 'u1' });
  });

  describe('list', () => {
    it('無內容時應返回 items 空陣列（F01 邊界）', async () => {
      req.query = { limit: '20' };
      mockListContent.mockResolvedValue([]);

      await controller.list(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { items: [] },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('成功應解析 query 並返回 items', async () => {
      req.query = {
        type: 'article',
        tags: 'a,b',
        language: 'zh',
        is_active: 'true',
        limit: '10',
      };
      const items = [{ id: '1', title: 't' }];
      mockListContent.mockResolvedValue(items);

      await controller.list(req as Request, res as Response, next);

      expect(mockListContent).toHaveBeenCalledWith({
        type: 'article',
        tags: ['a', 'b'],
        language: 'zh',
        is_active: true,
        limit: 10,
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { items } });
      expect(next).not.toHaveBeenCalled();
    });

    it('無 tags 時應傳 undefined 並 filter 後為空陣列', async () => {
      req.query = { type: 'article', limit: '20' };
      mockListContent.mockResolvedValue([]);

      await controller.list(req as Request, res as Response, next);

      expect(mockListContent).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: undefined,
          limit: 20,
          is_active: true,
        })
      );
    });

    it('tags 為空字串時應傳空陣列（F01 邊界：防禦性）', async () => {
      req.query = { type: 'article', tags: '', limit: '5' };
      mockListContent.mockResolvedValue([]);

      await controller.list(req as Request, res as Response, next);

      expect(mockListContent).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [],
          limit: 5,
        })
      );
    });

    it('query 完全為空時應使用預設 limit 20 與 is_active true', async () => {
      req.query = {};
      mockListContent.mockResolvedValue([]);

      await controller.list(req as Request, res as Response, next);

      expect(mockListContent).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          is_active: true,
        })
      );
    });

    it('limit 超過 100 時應 clamp 到 100（F01 邊界：MAX_CONTENT_LIMIT）', async () => {
      req.query = { limit: '200' };
      mockListContent.mockResolvedValue([]);

      await controller.list(req as Request, res as Response, next);

      expect(mockListContent).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });

    it('is_active 為 false 時應傳 false', async () => {
      req.query = { is_active: 'false', limit: '10' };
      mockListContent.mockResolvedValue([]);

      await controller.list(req as Request, res as Response, next);

      expect(mockListContent).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false })
      );
    });
  });

  describe('recommendations', () => {
    it('無推薦時應返回 items 空陣列（F01/F05 邊界）', async () => {
      req.params = { caseId: 'c1' };
      req.query = {};
      mockGetRecommendations.mockResolvedValue([]);

      await controller.recommendations(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { items: [] },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('成功應返回 items', async () => {
      req.params = { caseId: 'c1' };
      req.query = { relation: 'similar' };
      const items = [{ id: '1' }];
      mockGetRecommendations.mockResolvedValue(items);

      await controller.recommendations(req as Request, res as Response, next);

      expect(mockGetCaseById).toHaveBeenCalledWith('c1', 'u1', undefined);
      expect(mockGetRecommendations).toHaveBeenCalledWith('c1', 'similar');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { items } });
    });

    it('無 relation 時預設 recommend', async () => {
      req.params = { caseId: 'c1' };
      req.query = {};
      mockGetRecommendations.mockResolvedValue([]);

      await controller.recommendations(req as Request, res as Response, next);

      expect(mockGetRecommendations).toHaveBeenCalledWith('c1', 'recommend');
    });
  });

  describe('link', () => {
    it('成功應調用 linkContent 並返回 link', async () => {
      req.body = { case_id: 'c1', content_id: 'ct1', relation: 'recommend' };
      const link = { case_id: 'c1', content_id: 'ct1', relation: 'recommend' };
      mockLinkContent.mockResolvedValue(link);

      await controller.link(req as Request, res as Response, next);

      expect(mockGetCaseById).toHaveBeenCalledWith('c1', 'u1', undefined);
      expect(mockLinkContent).toHaveBeenCalledWith('c1', 'ct1', 'recommend');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { link },
        message: '已關聯內容',
      });
    });

    it('無 relation 時預設 recommend', async () => {
      req.body = { case_id: 'c1', content_id: 'ct1' };
      mockLinkContent.mockResolvedValue({});

      await controller.link(req as Request, res as Response, next);

      expect(mockLinkContent).toHaveBeenCalledWith('c1', 'ct1', 'recommend');
    });

    it('缺少 case_id 時應拋出 VALIDATION_ERROR 並 next(error)', async () => {
      req.body = { content_id: 'ct1' };

      await controller.link(req as Request, res as Response, next);

      expect(mockLinkContent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'case_id、content_id 為必填',
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('缺少 content_id 時應拋出 VALIDATION_ERROR', async () => {
      req.body = { case_id: 'c1' };

      await controller.link(req as Request, res as Response, next);

      expect(mockLinkContent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('relation 不在允許列表時應拋出 VALIDATION_ERROR', async () => {
      req.body = { case_id: 'c1', content_id: 'ct1', relation: 'invalid' };

      await controller.link(req as Request, res as Response, next);

      expect(mockLinkContent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('relation 只能是'),
        })
      );
    });
  });

  describe('錯誤時調用 next', () => {
    it('list 拋錯時應 next(error)', async () => {
      req.query = {};
      mockListContent.mockRejectedValue(new Error('db error'));

      await controller.list(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('recommendations 拋錯時應 next(error)', async () => {
      req.params = { caseId: 'c1' };
      req.query = {};
      mockGetRecommendations.mockRejectedValue(new Error('service error'));

      await controller.recommendations(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('link 拋錯時應 next(error)', async () => {
      req.body = { case_id: 'c1', content_id: 'ct1' };
      mockLinkContent.mockRejectedValue(new Error('link failed'));

      await controller.link(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
