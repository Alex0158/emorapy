import prisma from '../config/database';
import { Errors } from '../utils/errors';

export class ContentService {
  async listContent(options: {
    type?: string;
    tags?: string[];
    language?: string;
    is_active?: boolean;
    limit?: number;
  }) {
    const where: any = {};
    if (options.type) where.content_type = options.type;
    if (options.tags && options.tags.length > 0) {
      where.tags = { hasSome: options.tags };
    }
    if (options.language) where.language = options.language;
    if (options.is_active !== undefined) where.is_active = options.is_active;
    return prisma.contentItem.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: options.limit || 20,
    });
  }

  async getRecommendations(caseId: string, relation: string = 'recommend') {
    return prisma.caseContentLink.findMany({
      where: { case_id: caseId, relation },
      include: {
        content: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
  }

  async linkContent(caseId: string, contentId: string, relation: string = 'recommend') {
    const caseExists = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseExists) throw Errors.NOT_FOUND('案件不存在');
    const contentExists = await prisma.contentItem.findUnique({ where: { id: contentId } });
    if (!contentExists) throw Errors.NOT_FOUND('內容不存在');
    return prisma.caseContentLink.upsert({
      where: {
        case_id_content_id_relation: { case_id: caseId, content_id: contentId, relation },
      },
      create: {
        case_id: caseId,
        content_id: contentId,
        relation,
      },
      update: {},
    });
  }
}

export const contentService = new ContentService();
