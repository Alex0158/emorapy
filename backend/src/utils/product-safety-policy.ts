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
