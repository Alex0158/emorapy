export type JudgmentRoute = 'standard' | 'safety_support' | 'crisis_support';

export type ReconciliationIntentForSafetyPolicy = 'repair' | 'cool_down' | 'graceful_exit' | 'safety_support';

export interface ProductSafetyPolicy {
  route: JudgmentRoute;
  isHighRisk: boolean;
  defaultReconciliationIntent: ReconciliationIntentForSafetyPolicy;
  allowedReconciliationIntents: ReconciliationIntentForSafetyPolicy[];
  canInvitePartner: boolean;
  canUseCoRepair: boolean;
  canNotifyPartner: boolean;
  canShowResponsibilityRatio: boolean;
  forceSoloRepair: boolean;
  reasons: string[];
}

export interface ResponsibilityRatioVisibility {
  can_show: boolean;
  reason: string | null;
}

export interface ChatJudgmentRequestPolicy {
  route: JudgmentRoute;
  canRequestChatJudgment: boolean;
  shouldCreateSafetyNotice: boolean;
  noticeMessage: string | null;
  rejectionMessage: string | null;
  reasons: string[];
}

const ROUTE_VALUES = new Set<JudgmentRoute>(['standard', 'safety_support', 'crisis_support']);

export function isJudgmentRoute(value: unknown): value is JudgmentRoute {
  return typeof value === 'string' && ROUTE_VALUES.has(value as JudgmentRoute);
}

export function getResponsibilityRatioVisibilityForRoute(route: JudgmentRoute): ResponsibilityRatioVisibility {
  if (route === 'crisis_support') {
    return {
      can_show: false,
      reason: '危機支持路由不得展示責任比例，避免對高風險用戶形成責任施壓',
    };
  }

  if (route === 'safety_support') {
    return {
      can_show: false,
      reason: '安全支持路由不得展示責任比例，避免把安全風險對稱化',
    };
  }

  return {
    can_show: true,
    reason: null,
  };
}

export function getProductSafetyPolicy(route: JudgmentRoute): ProductSafetyPolicy {
  if (route === 'crisis_support') {
    return {
      route,
      isHighRisk: true,
      defaultReconciliationIntent: 'safety_support',
      allowedReconciliationIntents: ['safety_support', 'cool_down', 'graceful_exit'],
      canInvitePartner: false,
      canUseCoRepair: false,
      canNotifyPartner: false,
      canShowResponsibilityRatio: false,
      forceSoloRepair: true,
      reasons: ['危機支持路由不得進入共同修復或伴侶召回'],
    };
  }

  if (route === 'safety_support') {
    return {
      route,
      isHighRisk: true,
      defaultReconciliationIntent: 'safety_support',
      allowedReconciliationIntents: ['safety_support', 'cool_down', 'graceful_exit'],
      canInvitePartner: false,
      canUseCoRepair: false,
      canNotifyPartner: false,
      canShowResponsibilityRatio: false,
      forceSoloRepair: true,
      reasons: ['安全支持路由不得把關係風險對稱化或推進共同修復'],
    };
  }

  return {
    route,
    isHighRisk: false,
    defaultReconciliationIntent: 'repair',
    allowedReconciliationIntents: ['repair', 'cool_down', 'graceful_exit', 'safety_support'],
    canInvitePartner: true,
    canUseCoRepair: true,
    canNotifyPartner: true,
    canShowResponsibilityRatio: true,
    forceSoloRepair: false,
    reasons: ['標準路由允許一般修復旅程'],
  };
}

export function getChatJudgmentRequestPolicy(
  route: JudgmentRoute,
  reasons: string[] = []
): ChatJudgmentRequestPolicy {
  if (route === 'crisis_support') {
    return {
      route,
      canRequestChatJudgment: false,
      shouldCreateSafetyNotice: true,
      noticeMessage: '系統偵測到高風險危機訊號，已先切換安全支持流程，暫不進入一般判決。',
      rejectionMessage: '偵測到危機風險，請先進入安全支持流程',
      reasons: reasons.length > 0 ? reasons : ['危機支持路由不得由聊天室直接轉入一般判決'],
    };
  }

  if (route === 'safety_support') {
    return {
      route,
      canRequestChatJudgment: true,
      shouldCreateSafetyNotice: true,
      noticeMessage: '系統偵測到可能的安全風險訊號。後續判決將優先採用安全支持路由，避免對稱責任化建議。',
      rejectionMessage: null,
      reasons: reasons.length > 0 ? reasons : ['安全支持路由可轉判決，但必須保留安全降級提示'],
    };
  }

  return {
    route,
    canRequestChatJudgment: true,
    shouldCreateSafetyNotice: false,
    noticeMessage: null,
    rejectionMessage: null,
    reasons: reasons.length > 0 ? reasons : ['標準路由可由聊天室轉判決'],
  };
}
