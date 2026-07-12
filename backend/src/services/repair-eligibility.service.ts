import { getCaseProductFlow, isSessionBoundCase, type CaseProductFlow } from '../utils/case-classifier';
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
  chat_to_case_links?: unknown[] | null;
  _count?: {
    chat_to_case_links?: number | null;
  } | null;
}

export type RepairRelationshipScope =
  | 'quick_single_solo'
  | 'quick_collaborative_solo'
  | 'formal_single_party'
  | 'formal_dual_party'
  | 'chat_to_case_single_perspective'
  | 'chat_to_case_dual_perspective'
  | 'unclaimed_session_asset';

export type RepairPairingStrength =
  | 'none'
  | 'session_context'
  | 'weak_contextual'
  | 'formal_confirmed';

export interface RepairEligibilityPolicy {
  flow: 'session_bound' | 'formal_solo' | 'formal_dual';
  productFlow: CaseProductFlow;
  relationshipScope: RepairRelationshipScope;
  pairingStrength: RepairPairingStrength;
  canGeneratePlans: boolean;
  canInvitePartner: boolean;
  canUseCoRepair: boolean;
  canNotifyPartner: boolean;
  forceSoloRepair: boolean;
  reasons: string[];
}

export interface RepairJourneyAccessPolicy {
  flow: RepairEligibilityPolicy['flow'];
  productFlow: CaseProductFlow;
  relationshipScope: RepairRelationshipScope;
  pairingStrength: RepairPairingStrength;
  judgmentRoute: ProductSafetyPolicy['route'];
  defaultReconciliationIntent: ProductSafetyPolicy['defaultReconciliationIntent'];
  allowedReconciliationIntents: ProductSafetyPolicy['allowedReconciliationIntents'];
  canEnterRepairJourney: boolean;
  canInvitePartner: boolean;
  canUseCoRepair: boolean;
  canNotifyPartner: boolean;
  forceSoloRepair: boolean;
  safetySource?: 'active_risk_state' | 'fallback_route' | 'route_policy' | 'lookup_error';
  riskLevel?: string;
  reasons: string[];
}

export type RepairJourneyAccessContext = {
  flow: RepairEligibilityPolicy['flow'];
  product_flow: CaseProductFlow;
  relationship_scope: RepairRelationshipScope;
  pairing_strength: RepairPairingStrength;
  can_invite_partner: boolean;
  can_use_co_repair: boolean;
  can_notify_partner: boolean;
  force_solo_repair: boolean;
  safety_source?: RepairJourneyAccessPolicy['safetySource'];
  risk_level?: string;
  reasons: string[];
};

export function buildRepairAccessContext(policy: RepairJourneyAccessPolicy): RepairJourneyAccessContext {
  return {
    flow: policy.flow,
    product_flow: policy.productFlow,
    relationship_scope: policy.relationshipScope,
    pairing_strength: policy.pairingStrength,
    can_invite_partner: policy.canInvitePartner,
    can_use_co_repair: policy.canUseCoRepair,
    can_notify_partner: policy.canNotifyPartner,
    force_solo_repair: policy.forceSoloRepair,
    safety_source: policy.safetySource,
    risk_level: policy.riskLevel,
    reasons: policy.reasons,
  };
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
  const productFlow = getCaseProductFlow(caseRecord);
  const hasPlaintiff = Boolean(caseRecord.plaintiff_id);
  const hasDefendant = Boolean(caseRecord.defendant_id);
  const hasBothParties = hasPlaintiff && hasDefendant;

  if (!caseRecord.plaintiff_id && !caseRecord.defendant_id) {
    return {
      flow: 'formal_solo',
      productFlow,
      relationshipScope: 'unclaimed_session_asset',
      pairingStrength: productFlow === 'chat_to_case' ? 'weak_contextual' : 'none',
      canGeneratePlans: false,
      canInvitePartner: false,
      canUseCoRepair: false,
      canNotifyPartner: false,
      forceSoloRepair: true,
      reasons: ['修復旅程需要至少一個已登入當事人'],
    };
  }

  if (productFlow === 'chat_to_case') {
    return {
      flow: hasBothParties ? 'formal_dual' : 'formal_solo',
      productFlow,
      relationshipScope: hasBothParties ? 'chat_to_case_dual_perspective' : 'chat_to_case_single_perspective',
      pairingStrength: 'weak_contextual',
      canGeneratePlans: true,
      canInvitePartner: hasBothParties,
      canUseCoRepair: hasBothParties,
      canNotifyPartner: hasBothParties,
      forceSoloRepair: !hasBothParties,
      reasons: hasBothParties
        ? ['聊天室轉判決屬弱配對上下文；可共同修復但前端需標示為先聊再判的弱配對視角']
        : ['聊天室轉判決目前只有單方已登入身份，只能先走單方視角 solo 修復'],
    };
  }

  if (isSessionBoundCase(caseRecord)) {
    return {
      flow: 'session_bound',
      productFlow,
      relationshipScope: productFlow === 'quick_collaborative' ? 'quick_collaborative_solo' : 'quick_single_solo',
      pairingStrength: 'session_context',
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
      productFlow,
      relationshipScope: 'formal_single_party',
      pairingStrength: 'none',
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
    productFlow,
    relationshipScope: 'formal_dual_party',
    pairingStrength: 'formal_confirmed',
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
    | 'route'
    | 'defaultReconciliationIntent'
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
    flow: repairEligibility.flow,
    productFlow: repairEligibility.productFlow,
    relationshipScope: repairEligibility.relationshipScope,
    pairingStrength: repairEligibility.pairingStrength,
    judgmentRoute: safetyPolicy.route,
    defaultReconciliationIntent: safetyPolicy.defaultReconciliationIntent,
    allowedReconciliationIntents: safetyPolicy.allowedReconciliationIntents,
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
  | 'route'
  | 'defaultReconciliationIntent'
  | 'allowedReconciliationIntents'
  | 'canInvitePartner'
  | 'canUseCoRepair'
  | 'canNotifyPartner'
  | 'forceSoloRepair'
  | 'reasons'
> {
  const routePolicy = getProductSafetyPolicy(snapshot.judgment_route);
  return {
    route: routePolicy.route,
    defaultReconciliationIntent: routePolicy.defaultReconciliationIntent,
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
    logger.warn('Repair journey safety state lookup failed, fail closed', {
      judgmentId: judgment.id,
      caseId,
      error,
    });
    return {
      ...getRepairJourneyAccessPolicy({
        route: fallbackSafetyPolicy.route,
        defaultReconciliationIntent: 'safety_support',
        allowedReconciliationIntents: [],
        canInvitePartner: false,
        canUseCoRepair: false,
        canNotifyPartner: false,
        forceSoloRepair: true,
        reasons: ['安全狀態暫時無法確認，已停止修復、邀請、共同處理與通知操作'],
      }, repairEligibility),
      safetySource: 'lookup_error',
      riskLevel: 'unknown',
    };
  }
}
