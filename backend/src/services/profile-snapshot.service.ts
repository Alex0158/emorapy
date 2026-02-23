import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { profileRichnessService } from './profile-richness.service';
import type { SnapshotData } from '../types/interview.types';

export class ProfileSnapshotService {
  /**
   * 讀取最新敘事與有效洞見，計算豐富度，寫入 ProfileSnapshot（snapshot_data 為 JSON）
   */
  async createSnapshot(userId: string, caseId: string): Promise<void> {
    const [narratives, insights, richnessScore] = await Promise.all([
      prisma.profileNarrative.findMany({
        where: { user_id: userId, is_latest: true },
      }),
      prisma.profileInsight.findMany({
        where: { user_id: userId, is_active: true },
      }),
      profileRichnessService.calculateRichness(userId),
    ]);

    const snapshotData: SnapshotData = {
      narratives: narratives.map((n) => ({
        domain: n.domain,
        summary: n.ai_summary || n.raw_narrative.slice(0, 500),
        completeness: n.completeness ?? 0,
      })),
      insights: insights.map((i) => ({
        domain: i.domain,
        type: i.insight_type,
        key: i.key,
        value: i.value,
        confidence: i.confidence,
      })),
      richness_score: richnessScore,
      generated_at: new Date().toISOString(),
    };

    await prisma.profileSnapshot.upsert({
      where: {
        case_id_user_id: { case_id: caseId, user_id: userId },
      },
      create: {
        user_id: userId,
        case_id: caseId,
        snapshot_data: snapshotData as unknown as Prisma.InputJsonValue,
        richness_score: richnessScore,
      },
      update: {
        snapshot_data: snapshotData as unknown as Prisma.InputJsonValue,
        richness_score: richnessScore,
      },
    });
  }

  /**
   * 取得某案件某用戶的快照
   */
  async getSnapshot(caseId: string, userId: string) {
    return prisma.profileSnapshot.findUnique({
      where: {
        case_id_user_id: { case_id: caseId, user_id: userId },
      },
    });
  }
}

export const profileSnapshotService = new ProfileSnapshotService();
