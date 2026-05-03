import { isSessionBoundCase } from '../utils/case-classifier';
import logger from '../config/logger';
import { safetyAssessmentService } from './safety-assessment.service';
import { getProductSafetyPolicyForJudgment } from './safety-routing.service';
import {
  getProductSafetyPolicy,
  type ProductSafetyPolicy,
  type SafetyAssessmentSnapshot,
} from '../utils/product-safety-policy';

export interface RepairEligibilityCase {
  mode: string;
  session_id?: string | null;
  plaintiff_id?: string | null;
  defendant_id?: string | null;
}

export interface RepairEligibilityPolicy {
  flow: 'session_bound' | 'formal_solo' | 'formal_dual';
  canGeneratePlans: boolean;
  canInvitePartner: boolean;
  canUseCoRepair: boolean;
  canNotifyPartner: boolean;
  forceSoloRepair: boolean;
  reasons: string[];
}

export interface RepairJourneyAccessPolicy {
  canEnterRepairJourney: boolean;
  canInvitePartner: boolean;
  canUseCoRepair: boolean;
  canNotifyPartner: boolean;
  forceSoloRepair: boolean;
  safetySource?: 'active_risk_state' | 'fallback_route' | 'route_policy';
  riskLevel?: string;
  reasons: string[];
}

export interface RepairEligibilityJudgment {
  id?: string;
  emotional_analysis?: unknown;
  judgment_content?: string | null;
  case: RepairEligibilityCase & {
    id?: string;
  };
}

export function getRepairEligibilityForCase(caseRecord: RepairEligibilityCase): RepairEligibilityPolicy {
  if (!caseRecord.plaintiff_id && !caseRecord.defendant_id) {
    return {
      flow: 'formal_solo',
      canGeneratePlans: false,
      canInvitePartner: false,
      canUseCoRepair: false,
      canNotifyPartner: false,
      forceSoloRepair: true,
      reasons: ['修復旅程需要至少一個已登入當事人'],
    };
  }

  if (isSessionBoundCase(caseRecord)) {
    return {
      flow: 'session_bound',
      canGeneratePlans: true,
      canInvitePartner: false,
      canUseCoRepair: false,
      canNotifyPartner: false,
      forceSoloRepair: true,
      reasons: ['快速 / session-bound 案件只允許低壓 solo 修復，不做伴侶邀請或共同修復'],
    };
  }

  if (!caseRecord.plaintiff_id || !caseRecord.defendant_id) {
    return {
      flow: 'formal_solo',
      canGeneratePlans: true,
      canInvitePartner: false,
      canUseCoRepair: false,
      canNotifyPartner: false,
      forceSoloRepair: true,
      reasons: ['正式案件缺少另一方已登入身份，只能先走 solo 修復'],
    };
  }

  return {
    flow: 'formal_dual',
    canGeneratePlans: true,
    canInvitePartner: true,
    canUseCoRepair: true,
    canNotifyPartner: true,
    forceSoloRepair: false,
    reasons: ['正式雙方案件允許共同修復旅程'],
  };
}

export function getRepairJourneyAccessPolicy(
  safetyPolicy: Pick<
    ProductSafetyPolicy,
    | 'allowedReconciliationIntents'
    | 'canInvitePartner'
    | 'canUseCoRepair'
    | 'canNotifyPartner'
    | 'forceSoloRepair'
    | 'reasons'
  >,
  repairEligibility: RepairEligibilityPolicy
): RepairJourneyAccessPolicy {
  const canEnterRepairJourney =
    repairEligibility.canGeneratePlans &&
    safetyPolicy.allowedReconciliationIntents.length > 0;
  const canUseCoRepair = safetyPolicy.canUseCoRepair && repairEligibility.canUseCoRepair;
  const reasons = [
    ...safetyPolicy.reasons,
    ...repairEligibility.reasons,
  ];

  return {
    canEnterRepairJourney,
    canInvitePartner: safetyPolicy.canInvitePartner && repairEligibility.canInvitePartner,
    canUseCoRepair,
    canNotifyPartner: safetyPolicy.canNotifyPartner && repairEligibility.canNotifyPartner,
    forceSoloRepair: safetyPolicy.forceSoloRepair || repairEligibility.forceSoloRepair || !canUseCoRepair,
    reasons,
  };
}

function getRepairJourneySafetyPolicyFromSnapshot(
  snapshot: SafetyAssessmentSnapshot,
): Pick<
  ProductSafetyPolicy,
  | 'allowedReconciliationIntents'
  | 'canInvitePartner'
  | 'canUseCoRepair'
  | 'canNotifyPartner'
  | 'forceSoloRepair'
  | 'reasons'
> {
  const routePolicy = getProductSafetyPolicy(snapshot.judgment_route);
  return {
    allowedReconciliationIntents: routePolicy.allowedReconciliationIntents,
    canInvitePartner: snapshot.can_invite_partner,
    canUseCoRepair: snapshot.can_use_co_repair,
    canNotifyPartner: snapshot.can_notify_partner,
    forceSoloRepair: snapshot.force_solo_repair,
    reasons: snapshot.reasons.length > 0 ? snapshot.reasons : routePolicy.reasons,
  };
}

export async function getRepairJourneyAccessPolicyForJudgment(
  judgment: RepairEligibilityJudgment,
  repairEligibility: RepairEligibilityPolicy,
): Promise<RepairJourneyAccessPolicy> {
  const fallbackSafetyPolicy = getProductSafetyPolicyForJudgment(judgment);
  const caseId = judgment.case.id;
  if (!caseId) {
    return {
      ...getRepairJourneyAccessPolicy(fallbackSafetyPolicy, repairEligibility),
      safetySource: 'route_policy',
    };
  }

  try {
    const effective = await safetyAssessmentService.getEffectiveRouteSnapshot(
      { subjectType: 'case', subjectId: caseId },
      fallbackSafetyPolicy.route,
      {
        fallbackReasons: fallbackSafetyPolicy.reasons,
        fallbackMetadata: {
          judgment_id: judgment.id ?? null,
          case_id: caseId,
        },
      },
    );
    return {
      ...getRepairJourneyAccessPolicy(
        getRepairJourneySafetyPolicyFromSnapshot(effective.snapshot),
        repairEligibility,
      ),
      safetySource: effective.source,
      riskLevel: effective.snapshot.risk_level,
    };
  } catch (error) {
    logger.warn('Repair journey safety state lookup failed, fallback to route policy', {
      judgmentId: judgment.id,
      caseId,
      error,
    });
    return {
      ...getRepairJourneyAccessPolicy(fallbackSafetyPolicy, repairEligibility),
      safetySource: 'route_policy',
    };
  }
}
