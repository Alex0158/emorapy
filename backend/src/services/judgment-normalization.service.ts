import logger from '../config/logger';
import { getResponsibilityRatioVisibilityForRoute, isJudgmentRoute } from '../utils/product-safety-policy';
import {
  getJudgmentReconciliationPolicy,
  normalizeJudgment,
  type JudgmentReconciliationPolicy,
} from '../utils/judgment';
import { safetyAssessmentService } from './safety-assessment.service';

type NormalizableJudgment = Parameters<typeof normalizeJudgment>[0] & Record<string, unknown>;
type NormalizedJudgment<T extends NormalizableJudgment> = NonNullable<ReturnType<typeof normalizeJudgment<T>>> & {
  safety_state_status?: 'degraded';
  safety_risk_level?: 'unknown';
};

const DEGRADED_RATIO_REASON = '安全狀態暫時無法確認，已隱藏調整方向並停止修復操作';

function getFailClosedReconciliationPolicy(): JudgmentReconciliationPolicy {
  return {
    defaultReconciliationIntent: 'safety_support',
    allowedReconciliationIntents: [],
    canInvitePartner: false,
    canUseCoRepair: false,
    forceSoloRepair: true,
  };
}

function resolveCaseId(judgment: Record<string, unknown>, explicitCaseId?: string | null): string | null {
  if (explicitCaseId) {
    return explicitCaseId;
  }

  if (typeof judgment.case_id === 'string') {
    return judgment.case_id;
  }

  const rawCase = judgment.case;
  if (rawCase && typeof rawCase === 'object' && typeof (rawCase as Record<string, unknown>).id === 'string') {
    return (rawCase as Record<string, unknown>).id as string;
  }

  return null;
}

export function normalizeJudgmentWithSafetyState<T extends NormalizableJudgment>(
  judgment: T,
  options?: { caseId?: string | null },
): Promise<NormalizedJudgment<T>>;
export function normalizeJudgmentWithSafetyState<T extends NormalizableJudgment>(
  judgment: T | null,
  options?: { caseId?: string | null },
): Promise<NormalizedJudgment<T> | null>;
export async function normalizeJudgmentWithSafetyState<T extends NormalizableJudgment>(
  judgment: T | null,
  options: { caseId?: string | null } = {},
): Promise<NormalizedJudgment<T> | null> {
  const normalized = normalizeJudgment(judgment) as NormalizedJudgment<T> | null;
  if (!normalized || !judgment) return normalized;

  const rawJudgment = judgment as Record<string, unknown>;
  const caseId = resolveCaseId(rawJudgment, options.caseId);
  if (!caseId) {
    return normalized;
  }

  try {
    const activeState = await safetyAssessmentService.getActiveRiskState({
      subjectType: 'case',
      subjectId: caseId,
    });
    if (!activeState) {
      return normalized;
    }

    const route = isJudgmentRoute(activeState.judgment_route)
      ? activeState.judgment_route
      : normalized.judgment_route;
    const effectiveRoute = isJudgmentRoute(route) ? route : 'standard';
    normalized.judgment_route = effectiveRoute;

    const routeVisibility = getResponsibilityRatioVisibilityForRoute(effectiveRoute);
    normalized.responsibility_ratio_visibility = {
      can_show: activeState.can_show_responsibility_ratio,
      reason: activeState.can_show_responsibility_ratio
        ? null
        : routeVisibility?.reason
          ?? activeState.reasons[0]
          ?? '目前安全狀態不允許展示責任比例',
    };
    normalized.reconciliation_policy = getJudgmentReconciliationPolicy(effectiveRoute);
    return normalized;
  } catch (error) {
    logger.warn('Judgment safety state lookup failed, fail closed', {
      judgmentId: rawJudgment.id,
      caseId,
      error,
    });
    normalized.responsibility_ratio_visibility = {
      can_show: false,
      reason: DEGRADED_RATIO_REASON,
    };
    normalized.reconciliation_policy = getFailClosedReconciliationPolicy();
    normalized.safety_state_status = 'degraded';
    normalized.safety_risk_level = 'unknown';
    return normalized;
  }
}
