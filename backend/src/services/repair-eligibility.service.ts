import { isSessionBoundCase } from '../utils/case-classifier';
import type { ProductSafetyPolicy } from '../utils/product-safety-policy';

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
  reasons: string[];
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
