import prisma from '../config/database';
import { Errors } from '../utils/errors';
import { profileRichnessService } from './profile-richness.service';
import { INTERVIEW_STATUS } from '../utils/constants';

export class PsychProfileService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { psych_consent_given: true, psych_consent_at: true },
    });
    if (!user) throw Errors.NOT_FOUND('用戶不存在');

    const narratives = await prisma.profileNarrative.findMany({
      where: { user_id: userId, is_latest: true },
      orderBy: { domain: 'asc' },
    });
    const insights = await prisma.profileInsight.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: [{ domain: 'asc' }, { created_at: 'desc' }],
    });
    const richness_score = await profileRichnessService.calculateRichness(userId);

    return {
      consent_given: user.psych_consent_given,
      consent_at: user.psych_consent_at?.toISOString() ?? null,
      narratives,
      insights,
      richness_score,
    };
  }

  async getFeedbackHistory(userId: string) {
    const sessions = await prisma.interviewSession.findMany({
      where: {
        user_id: userId,
        status: INTERVIEW_STATUS.COMPLETED,
        feedback_card: { not: null },
      },
      select: {
        id: true,
        feedback_card: true,
        domains_touched: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { updated_at: 'desc' },
      take: 50,
    });
    return {
      history: sessions.map((s) => ({
        session_id: s.id,
        feedback_card: s.feedback_card,
        domains_touched: s.domains_touched,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
    };
  }

  async giveConsent(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        psych_consent_given: true,
        psych_consent_at: new Date(),
      },
    });
  }

  async deleteAllData(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw Errors.NOT_FOUND('用戶不存在');

    await prisma.$transaction([
      prisma.profileInsight.deleteMany({ where: { user_id: userId } }),
      prisma.profileNarrative.deleteMany({ where: { user_id: userId } }),
      // ProfileSnapshot 保留：判決紀錄完整性（consent.point3 已告知用戶）
      prisma.interviewTurn.deleteMany({
        where: { session: { user_id: userId } },
      }),
      prisma.interviewSession.deleteMany({ where: { user_id: userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { psych_consent_given: false, psych_consent_at: null },
      }),
    ]);
  }
}

export const psychProfileService = new PsychProfileService();
