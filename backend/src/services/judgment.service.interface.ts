import type { GenerateJudgmentOptions } from './judgment.service';

/**
 * 判決服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * JudgmentService 符合此介面；Controller 可選改為依賴 IJudgmentService 並在建構時注入。
 */

export interface IJudgmentService {
  generateJudgment(
    caseId: string,
    options?: GenerateJudgmentOptions
  ): Promise<unknown>;

  getJudgmentByCaseId(
    caseId: string,
    userId?: string,
    sessionId?: string
  ): Promise<unknown>;

  acceptJudgment(
    judgmentId: string,
    userId: string,
    accepted: boolean,
    rating?: number
  ): Promise<unknown>;

  repairJudgmentResponse(
    judgmentId: string,
    feedback: string,
    options?: { userId?: string; sessionId?: string }
  ): Promise<unknown>;

  recordClinicalMetrics(
    judgmentId: string,
    metrics: {
      felt_understood: number;
      felt_blamed: number;
      willing_to_try: number;
    },
    options?: { userId?: string; sessionId?: string }
  ): Promise<unknown>;
}
