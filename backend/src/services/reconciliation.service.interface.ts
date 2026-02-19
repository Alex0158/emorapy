/**
 * 和好方案服務介面（供 DI / 單測 mock 使用，見 docs/audit/di-design-20260206.md）
 * ReconciliationService 符合此介面；Controller 可選改為依賴 IReconciliationService 並在建構時注入。
 */

export interface PlanPreferencesForInterface {
  difficulty?: 'easy' | 'medium' | 'hard';
  duration?: number;
  types?: ('activity' | 'communication' | 'intimacy' | 'gift' | 'service')[];
}

export interface GetPlansFilters {
  difficulty?: 'easy' | 'medium' | 'hard';
  type?: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
}

export interface IReconciliationService {
  generatePlans(
    judgmentId: string,
    preferences?: PlanPreferencesForInterface,
    userId?: string
  ): Promise<unknown>;

  getPlansByJudgmentId(
    judgmentId: string,
    filters?: GetPlansFilters
  ): Promise<unknown>;

  getPlanById(planId: string, userId?: string): Promise<unknown>;

  selectPlan(planId: string, userId: string): Promise<unknown>;
}
