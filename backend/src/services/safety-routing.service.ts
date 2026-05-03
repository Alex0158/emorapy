import { IPV_SIGNAL_REGEX, CRISIS_SIGNAL_REGEX } from './ai.service';
import {
  getProductSafetyPolicy,
  isJudgmentRoute,
  type JudgmentRoute,
  type ProductSafetyPolicy,
  type ReconciliationIntentForSafetyPolicy,
} from '../utils/product-safety-policy';

export {
  getProductSafetyPolicy,
  type JudgmentRoute,
  type ProductSafetyPolicy,
  type ReconciliationIntentForSafetyPolicy,
};

export interface RoutingAnalysisInput {
  severity?: string;
  safetyFlags?: string[];
}

export interface SafetyRouteDecision {
  route: JudgmentRoute;
  reasons: string[];
  detectedFlags: string[];
}

function readStoredRoute(emotionalAnalysis?: unknown): JudgmentRoute | null {
  if (!emotionalAnalysis || typeof emotionalAnalysis !== 'object') {
    return null;
  }
  const record = emotionalAnalysis as Record<string, unknown>;
  const route = record.route ?? record.judgment_route;
  return isJudgmentRoute(route)
    ? route
    : null;
}

export function getProductSafetyPolicyForJudgment(input: {
  emotional_analysis?: unknown;
  judgment_content?: string | null;
}): ProductSafetyPolicy {
  const storedRoute = readStoredRoute(input.emotional_analysis);
  if (storedRoute) {
    return getProductSafetyPolicy(storedRoute);
  }

  if (input.judgment_content) {
    const fallbackDecision = safetyRoutingService.decideRoute({
      plaintiffStatement: input.judgment_content,
      defendantStatement: '',
    });
    return getProductSafetyPolicy(fallbackDecision.route);
  }

  return getProductSafetyPolicy('standard');
}

/**
 * 判決前安全分流：
 * - crisis_support：自傷/自殺風險，優先生命安全
 * - safety_support：IPV/控制/威脅，優先安全與保護
 * - standard：一般衝突處理路徑
 */
export class SafetyRoutingService {
  decideRoute(input: {
    analysis?: RoutingAnalysisInput | null;
    plaintiffStatement: string;
    defendantStatement: string;
  }): SafetyRouteDecision {
    const reasons: string[] = [];
    const detectedFlags: string[] = [];

    const combined = `${input.plaintiffStatement || ''} ${input.defendantStatement || ''}`;
    const analysisFlags = input.analysis?.safetyFlags || [];
    const joinedFlags = analysisFlags.join('、');

    const hasCrisis =
      CRISIS_SIGNAL_REGEX.test(combined) || /自傷|自殺/.test(joinedFlags);
    const hasIPV =
      IPV_SIGNAL_REGEX.test(combined) ||
      /控制|威脅|暴力|權力不對等|經濟控制|人身威脅|貶低人格|孤立社交/.test(joinedFlags);

    if (hasCrisis) {
      detectedFlags.push('自傷/自殺風險');
      reasons.push('偵測到危機信號，需進入危機支持路徑');
      return { route: 'crisis_support', reasons, detectedFlags };
    }

    if (hasIPV) {
      detectedFlags.push('控制/暴力/威脅風險');
      reasons.push('偵測到安全風險，需進入安全支持路徑');
      return { route: 'safety_support', reasons, detectedFlags };
    }

    if (input.analysis?.severity === 'serious') {
      reasons.push('嚴重衝突但無明確危機信號，維持標準路徑並加強情緒承接');
    } else {
      reasons.push('未偵測到高風險信號，使用標準路徑');
    }

    return { route: 'standard', reasons, detectedFlags };
  }
}

export const safetyRoutingService = new SafetyRoutingService();
