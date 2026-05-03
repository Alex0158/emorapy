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

export interface EvidenceSafetyAssertion {
  contains_minor: boolean;
  contains_sensitive_content: boolean;
  contains_nonconsensual_content: boolean;
  contains_illegal_content: boolean;
  minor_guardian_or_self_upload_confirmed: boolean;
  sensitive_content_handling_ack: boolean;
}

export interface EvidenceSafetyAssertionPolicy {
  assertionProvided: boolean;
  canUpload: boolean;
  rejectionMessage: string | null;
  normalized: EvidenceSafetyAssertion | null;
  metadata: Record<string, unknown> | null;
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

const EVIDENCE_ASSERTION_FIELDS = [
  'contains_minor',
  'contains_sensitive_content',
  'contains_nonconsensual_content',
  'contains_illegal_content',
  'minor_guardian_or_self_upload_confirmed',
  'sensitive_content_handling_ack',
] as const;

function parseBooleanLike(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function extractEvidenceSafetyAssertion(input: unknown): { provided: boolean; value: Record<string, unknown> | null; error?: string } {
  if (!input || typeof input !== 'object') {
    return { provided: false, value: null };
  }

  const body = input as Record<string, unknown>;
  const rawAssertion = body.safety_assertion ?? body.safetyAssertion;
  if (rawAssertion != null) {
    if (typeof rawAssertion === 'string') {
      try {
        const parsed = JSON.parse(rawAssertion) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return { provided: true, value: null, error: 'safety_assertion 必須是 JSON object' };
        }
        return { provided: true, value: parsed as Record<string, unknown> };
      } catch {
        return { provided: true, value: null, error: 'safety_assertion 必須是有效 JSON' };
      }
    }
    if (typeof rawAssertion === 'object' && !Array.isArray(rawAssertion)) {
      return { provided: true, value: rawAssertion as Record<string, unknown> };
    }
    return { provided: true, value: null, error: 'safety_assertion 必須是 JSON object' };
  }

  const hasInlineAssertion = EVIDENCE_ASSERTION_FIELDS.some((field) => body[field] != null);
  if (!hasInlineAssertion) {
    return { provided: false, value: null };
  }

  const inline: Record<string, unknown> = {};
  for (const field of EVIDENCE_ASSERTION_FIELDS) {
    inline[field] = body[field];
  }
  return { provided: true, value: inline };
}

export function getEvidenceSafetyAssertionPolicy(input: unknown): EvidenceSafetyAssertionPolicy {
  const extracted = extractEvidenceSafetyAssertion(input);
  if (!extracted.provided) {
    return {
      assertionProvided: false,
      canUpload: true,
      rejectionMessage: null,
      normalized: null,
      metadata: null,
      reasons: ['未提供證據安全聲明，按舊版上傳契約處理'],
    };
  }

  if (!extracted.value) {
    return {
      assertionProvided: true,
      canUpload: false,
      rejectionMessage: extracted.error ?? '證據安全聲明格式不正確',
      normalized: null,
      metadata: null,
      reasons: ['證據安全聲明格式不正確'],
    };
  }

  const normalized: EvidenceSafetyAssertion = {
    contains_minor: parseBooleanLike(extracted.value.contains_minor),
    contains_sensitive_content: parseBooleanLike(extracted.value.contains_sensitive_content),
    contains_nonconsensual_content: parseBooleanLike(extracted.value.contains_nonconsensual_content),
    contains_illegal_content: parseBooleanLike(extracted.value.contains_illegal_content),
    minor_guardian_or_self_upload_confirmed: parseBooleanLike(extracted.value.minor_guardian_or_self_upload_confirmed),
    sensitive_content_handling_ack: parseBooleanLike(extracted.value.sensitive_content_handling_ack),
  };

  if (normalized.contains_illegal_content || normalized.contains_nonconsensual_content) {
    return {
      assertionProvided: true,
      canUpload: false,
      rejectionMessage: '此類非同意或非法內容不可作為證據上傳',
      normalized,
      metadata: null,
      reasons: ['非同意或非法內容不得進入證據上傳與 AI 處理鏈路'],
    };
  }

  if (normalized.contains_minor && !normalized.minor_guardian_or_self_upload_confirmed) {
    return {
      assertionProvided: true,
      canUpload: false,
      rejectionMessage: '涉及未成年人內容時，必須先確認具備合法上傳依據',
      normalized,
      metadata: null,
      reasons: ['未成年人相關證據缺少合法上傳依據確認'],
    };
  }

  if (normalized.contains_sensitive_content && !normalized.sensitive_content_handling_ack) {
    return {
      assertionProvided: true,
      canUpload: false,
      rejectionMessage: '涉及敏感內容時，必須先確認已理解資料處理與 AI 使用風險',
      normalized,
      metadata: null,
      reasons: ['敏感內容證據缺少資料處理風險確認'],
    };
  }

  return {
    assertionProvided: true,
    canUpload: true,
    rejectionMessage: null,
    normalized,
    metadata: {
      kind: 'evidence_safety_assertion',
      version: 1,
      normalized,
      reasons: ['證據安全聲明已通過後端 gate'],
    },
    reasons: ['證據安全聲明已通過後端 gate'],
  };
}
