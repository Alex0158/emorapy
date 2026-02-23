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
export function isResponsibilityRatio(obj: unknown): obj is ResponsibilityRatio {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'plaintiff' in obj &&
    'defendant' in obj &&
    typeof (obj as ResponsibilityRatio).plaintiff === 'number' &&
    typeof (obj as ResponsibilityRatio).defendant === 'number' &&
    (obj as ResponsibilityRatio).plaintiff >= 0 &&
    (obj as ResponsibilityRatio).defendant >= 0 &&
    Math.abs((obj as ResponsibilityRatio).plaintiff + (obj as ResponsibilityRatio).defendant - 100) < 0.01
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
  obj: unknown
): obj is ReconciliationPlanContent {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.description === 'string' &&
    Array.isArray(o.steps) &&
    typeof o.expected_effect === 'string' &&
    typeof o.time_cost === 'number' &&
    typeof o.money_cost === 'number' &&
    typeof o.emotion_cost === 'number' &&
    typeof o.skill_requirement === 'number' &&
    ['activity', 'communication', 'intimacy', 'gift', 'service'].includes(o.plan_type as string)
  );
}
