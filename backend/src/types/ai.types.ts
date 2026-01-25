/**
 * AI服務相關類型定義
 */

/**
 * 責任分比例
 */
export interface ResponsibilityRatio {
  plaintiff: number;
  defendant: number;
}

/**
 * 責任分比例類型守衛
 */
export function isResponsibilityRatio(obj: any): obj is ResponsibilityRatio {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.plaintiff === 'number' &&
    typeof obj.defendant === 'number' &&
    obj.plaintiff >= 0 &&
    obj.defendant >= 0 &&
    Math.abs(obj.plaintiff + obj.defendant - 100) < 0.01
  );
}

/**
 * 和好方案內容
 */
export interface ReconciliationPlanContent {
  title: string;
  description: string;
  steps: string[];
  expected_effect: string;
  time_cost: number;
  money_cost: number;
  emotion_cost: number;
  skill_requirement: number;
  plan_type: 'activity' | 'communication' | 'intimacy' | 'gift' | 'service';
  estimated_duration?: number;
  difficulty_level?: 'easy' | 'medium' | 'hard';
}

/**
 * 和好方案內容類型守衛
 */
export function isReconciliationPlanContent(
  obj: any
): obj is ReconciliationPlanContent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.title === 'string' &&
    typeof obj.description === 'string' &&
    Array.isArray(obj.steps) &&
    typeof obj.expected_effect === 'string' &&
    typeof obj.time_cost === 'number' &&
    typeof obj.money_cost === 'number' &&
    typeof obj.emotion_cost === 'number' &&
    typeof obj.skill_requirement === 'number' &&
    ['activity', 'communication', 'intimacy', 'gift', 'service'].includes(obj.plan_type)
  );
}
