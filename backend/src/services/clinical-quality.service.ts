import { cacheService, CacheService } from '../utils/cache';
import logger from '../config/logger';
import type { JudgmentRoute } from './safety-routing.service';

export interface ClinicalQualityMetricsInput {
  judgmentId: string;
  promptVersion: string;
  caseType?: string;
  route?: JudgmentRoute;
  feltUnderstood: number;
  feltBlamed: number;
  willingToTry: number;
}

/**
 * 臨床品質指標記錄（MVP）：
 * 先以 cache 聚合，避免資料庫遷移阻塞主流程。
 */
export class ClinicalQualityService {
  async recordPostResponseMetrics(input: ClinicalQualityMetricsInput): Promise<void> {
    const bucketDate = new Date().toISOString().slice(0, 10);
    const route = input.route || 'standard';
    const scope = `${bucketDate}:${input.promptVersion}:${route}:${input.caseType || 'unknown'}`;
    const key = CacheService.generateKey('clinical:metrics:aggregate', scope);

    const current = (await cacheService.get<{
      count: number;
      understoodSum: number;
      blamedSum: number;
      willingSum: number;
    }>(key)) || {
      count: 0,
      understoodSum: 0,
      blamedSum: 0,
      willingSum: 0,
    };

    const next = {
      count: current.count + 1,
      understoodSum: current.understoodSum + input.feltUnderstood,
      blamedSum: current.blamedSum + input.feltBlamed,
      willingSum: current.willingSum + input.willingToTry,
    };

    await cacheService.set(key, next, 30 * 24 * 60 * 60);

    logger.info('Clinical quality metrics recorded', {
      judgmentId: input.judgmentId,
      route,
      promptVersion: input.promptVersion,
      caseType: input.caseType,
      metrics: {
        feltUnderstood: input.feltUnderstood,
        feltBlamed: input.feltBlamed,
        willingToTry: input.willingToTry,
      },
      aggregate: {
        count: next.count,
        avgUnderstood: Number((next.understoodSum / next.count).toFixed(2)),
        avgBlamed: Number((next.blamedSum / next.count).toFixed(2)),
        avgWilling: Number((next.willingSum / next.count).toFixed(2)),
      },
    });
  }
}

export const clinicalQualityService = new ClinicalQualityService();

