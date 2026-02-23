import prisma from '../config/database';
import { DOMAIN_WEIGHTS, TOTAL_WEIGHT, getRichnessLevel as getLevel, type RichnessLevel } from '../types/interview.types';

export class ProfileRichnessService {
  /**
   * 依最新敘事計算加權豐富度：Σ(domain_completeness × domain_weight) / TOTAL_WEIGHT
   */
  async calculateRichness(userId: string): Promise<number> {
    const latest = await prisma.profileNarrative.findMany({
      where: { user_id: userId, is_latest: true },
    });
    if (latest.length === 0) return 0;
    let weighted = 0;
    for (const n of latest) {
      const w = DOMAIN_WEIGHTS[n.domain] ?? 1;
      weighted += (n.completeness ?? 0) * w;
    }
    return Math.max(0, Math.min(1, weighted / TOTAL_WEIGHT));
  }

  /**
   * 取得當前豐富度等級
   */
  async getRichnessLevel(userId: string): Promise<RichnessLevel> {
    const score = await this.calculateRichness(userId);
    return getLevel(score);
  }
}

export const profileRichnessService = new ProfileRichnessService();
