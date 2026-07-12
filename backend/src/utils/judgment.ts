/**
 * 判決相關工具函數
 */
import {
  getProductSafetyPolicy,
  getResponsibilityRatioVisibilityForRoute,
  isJudgmentRoute,
  type ProductSafetyPolicy,
  type ResponsibilityRatioVisibility,
} from './product-safety-policy';

type JudgmentLike = {
  plaintiff_ratio: number;
  defendant_ratio: number;
};

type WithResponsibilityRatio = {
  responsibility_ratio?: { plaintiff: number; defendant: number };
};

type WithJudgmentRoute = {
  judgment_route?: 'standard' | 'safety_support' | 'crisis_support';
};

type WithResponsibilityRatioVisibility = {
  responsibility_ratio_visibility?: ResponsibilityRatioVisibility;
};

export type JudgmentReconciliationPolicy = Pick<
  ProductSafetyPolicy,
  | 'defaultReconciliationIntent'
  | 'allowedReconciliationIntents'
  | 'canInvitePartner'
  | 'canUseCoRepair'
  | 'forceSoloRepair'
>;

type WithReconciliationPolicy = {
  reconciliation_policy?: JudgmentReconciliationPolicy;
};

export function getJudgmentReconciliationPolicy(
  route: 'standard' | 'safety_support' | 'crisis_support',
): JudgmentReconciliationPolicy {
  const policy = getProductSafetyPolicy(route);
  return {
    defaultReconciliationIntent: policy.defaultReconciliationIntent,
    allowedReconciliationIntents: policy.allowedReconciliationIntents,
    canInvitePartner: policy.canInvitePartner,
    canUseCoRepair: policy.canUseCoRepair,
    forceSoloRepair: policy.forceSoloRepair,
  };
}

const INTERNAL_FIELDS = ['emotional_analysis'] as const;

/**
 * 將判決標準化為向後兼容的格式，補充 responsibility_ratio，
 * 並移除不應暴露給前端的內部欄位（如 emotional_analysis 等臨床診斷資料）。
 */
export function normalizeJudgment<T extends JudgmentLike>(judgment: T): Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio & WithJudgmentRoute & WithResponsibilityRatioVisibility & WithReconciliationPolicy;
export function normalizeJudgment<T extends JudgmentLike>(judgment: T | null): (Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio & WithJudgmentRoute & WithResponsibilityRatioVisibility & WithReconciliationPolicy) | null;
export function normalizeJudgment<T extends JudgmentLike>(judgment: T | null): (Omit<T, typeof INTERNAL_FIELDS[number]> & WithResponsibilityRatio & WithJudgmentRoute & WithResponsibilityRatioVisibility & WithReconciliationPolicy) | null {
  if (!judgment) return null;

  const emotionalAnalysis = (judgment as Record<string, unknown>).emotional_analysis;
  const routeFromAnalysis = emotionalAnalysis && typeof emotionalAnalysis === 'object'
    ? (emotionalAnalysis as Record<string, unknown>).route
    : undefined;
  const result = { ...judgment };
  for (const field of INTERNAL_FIELDS) {
    delete (result as Record<string, unknown>)[field];
  }
  const storedRoute = (judgment as Record<string, unknown>).judgment_route;
  const route = isJudgmentRoute(routeFromAnalysis)
    ? routeFromAnalysis
    : isJudgmentRoute(storedRoute)
      ? storedRoute
      : 'standard';
  (result as Record<string, unknown>).judgment_route = route;
  (result as Record<string, unknown>).responsibility_ratio_visibility = getResponsibilityRatioVisibilityForRoute(route);
  (result as Record<string, unknown>).reconciliation_policy = getJudgmentReconciliationPolicy(route);

  if (
    result.plaintiff_ratio !== undefined &&
    result.defendant_ratio !== undefined &&
    !(result as typeof result & WithResponsibilityRatio).responsibility_ratio
  ) {
    return {
      ...result,
      responsibility_ratio: {
        plaintiff: Number(result.plaintiff_ratio),
        defendant: Number(result.defendant_ratio),
      },
    };
  }
  return result;
}
