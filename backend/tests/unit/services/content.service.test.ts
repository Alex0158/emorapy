/**
 * ContentService 單元測試（mock Prisma）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  contentItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  case: { findUnique: jest.fn() },
  caseContentLink: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { ContentService } from '../../../src/services/content.service';

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentService();
  });

  describe('listContent', () => {
    it('無條件時應查詢全部並限制 20 條', async () => {
      prismaMock.contentItem.findMany.mockResolvedValue([]);

      await service.listContent({});

      expect(prismaMock.contentItem.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: 'desc' },
        take: 20,
      });
    });

    it('無內容時應返回空陣列（F01 邊界：content list 空結果）', async () => {
      prismaMock.contentItem.findMany.mockResolvedValue([]);

      const result = await service.listContent({});

      expect(result).toEqual([]);
    });

    it('有 type、tags、language、is_active、limit 時應傳入 where 與 take', async () => {
      prismaMock.contentItem.findMany.mockResolvedValue([]);

      await service.listContent({
        type: 'article',
        tags: ['tag1'],
        language: 'zh',
        is_active: true,
        limit: 5,
      });

      expect(prismaMock.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          content_type: 'article',
          tags: { hasSome: ['tag1'] },
          language: 'zh',
          is_active: true,
        },
        orderBy: { created_at: 'desc' },
        take: 5,
      });
    });

    it('應返回查詢結果', async () => {
      const items = [{ id: 'c1', content_type: 'article' }];
      prismaMock.contentItem.findMany.mockResolvedValue(items);

      const result = await service.listContent({ type: 'article' });

      expect(result).toEqual(items);
    });

    it('tags 為空陣列時應不設置 where.tags（F01 邊界：等價於查全部）', async () => {
      prismaMock.contentItem.findMany.mockResolvedValue([]);

      await service.listContent({ tags: [], limit: 5 });

      expect(prismaMock.contentItem.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: 'desc' },
        take: 5,
      });
    });

    it('limit 為 0 時應使用 20（防禦性：0 為 falsy）', async () => {
      prismaMock.contentItem.findMany.mockResolvedValue([]);

      await service.listContent({ limit: 0 });

      expect(prismaMock.contentItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 })
      );
    });
  });

  describe('getRecommendations', () => {
    it('應按 case_id 與 relation 查詢並返回', async () => {
      const links = [
        { id: 'l1', case_id: 'case-1', content: { id: 'c1', title: 't' } },
      ];
      prismaMock.caseContentLink.findMany.mockResolvedValue(links);

      const result = await service.getRecommendations('case-1', 'recommend');

      expect(result).toEqual(links);
      expect(prismaMock.caseContentLink.findMany).toHaveBeenCalledWith({
        where: { case_id: 'case-1', relation: 'recommend' },
        include: { content: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      });
    });

    it('自定義 relation 時應傳入', async () => {
      prismaMock.caseContentLink.findMany.mockResolvedValue([]);

      await service.getRecommendations('case-1', 'related');

      expect(prismaMock.caseContentLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { case_id: 'case-1', relation: 'related' },
        })
      );
    });

    it('無關聯時應返回空陣列（F01/F05 邊界：案件無推薦內容）', async () => {
      prismaMock.caseContentLink.findMany.mockResolvedValue([]);

      const result = await service.getRecommendations('case-1', 'recommend');

      expect(result).toEqual([]);
    });
  });

  describe('linkContent', () => {
    it('案件不存在應拋出 NOT_FOUND', async () => {
      prismaMock.case.findUnique.mockResolvedValue(null);

      await expect(
        service.linkContent('case-1', 'content-1', 'recommend')
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: expect.stringContaining('案件') });

      expect(prismaMock.caseContentLink.upsert).not.toHaveBeenCalled();
    });

    it('內容不存在應拋出 NOT_FOUND', async () => {
      prismaMock.case.findUnique.mockResolvedValue({ id: 'case-1' });
      prismaMock.contentItem.findUnique.mockResolvedValue(null);

      await expect(
        service.linkContent('case-1', 'content-1', 'recommend')
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: expect.stringContaining('內容') });
    });

    it('成功應 upsert 關聯', async () => {
      prismaMock.case.findUnique.mockResolvedValue({ id: 'case-1' });
      prismaMock.contentItem.findUnique.mockResolvedValue({ id: 'content-1' });
      prismaMock.caseContentLink.upsert.mockResolvedValue({
        case_id: 'case-1',
        content_id: 'content-1',
        relation: 'recommend',
      });

      const result = await service.linkContent('case-1', 'content-1', 'recommend');

      expect(result.relation).toBe('recommend');
      expect(prismaMock.caseContentLink.upsert).toHaveBeenCalledWith({
        where: {
          case_id_content_id_relation: {
            case_id: 'case-1',
            content_id: 'content-1',
            relation: 'recommend',
          },
        },
        create: {
          case_id: 'case-1',
          content_id: 'content-1',
          relation: 'recommend',
        },
        update: {},
      });
    });

    it('默認 relation 為 recommend', async () => {
      prismaMock.case.findUnique.mockResolvedValue({ id: 'case-1' });
      prismaMock.contentItem.findUnique.mockResolvedValue({ id: 'content-1' });
      prismaMock.caseContentLink.upsert.mockResolvedValue({});

      await service.linkContent('case-1', 'content-1');

      expect(prismaMock.caseContentLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            case_id_content_id_relation: {
              case_id: 'case-1',
              content_id: 'content-1',
              relation: 'recommend',
            },
          },
        })
      );
    });
  });
});
