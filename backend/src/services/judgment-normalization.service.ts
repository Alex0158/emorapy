import logger from '../config/logger';
import { getResponsibilityRatioVisibilityForRoute, isJudgmentRoute } from '../utils/product-safety-policy';
import { normalizeJudgment } from '../utils/judgment';
import { safetyAssessmentService } from './safety-assessment.service';

type NormalizableJudgment = Parameters<typeof normalizeJudgment>[0] & Record<string, unknown>;
type NormalizedJudgment<T extends NormalizableJudgment> = NonNullable<ReturnType<typeof normalizeJudgment<T>>>;

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
  const normalized = normalizeJudgment(judgment);
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
    if (route) {
      normalized.judgment_route = route;
    }

    const routeVisibility = route ? getResponsibilityRatioVisibilityForRoute(route) : null;
    normalized.responsibility_ratio_visibility = {
      can_show: activeState.can_show_responsibility_ratio,
      reason: activeState.can_show_responsibility_ratio
        ? null
        : routeVisibility?.reason
          ?? activeState.reasons[0]
          ?? '目前安全狀態不允許展示責任比例',
    };
    return normalized;
  } catch (error) {
    logger.warn('Judgment safety state lookup failed, fallback to stored route visibility', {
      judgmentId: rawJudgment.id,
      caseId,
      error,
    });
    return normalized;
  }
}
