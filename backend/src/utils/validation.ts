/**
 * 統一驗證工具類
 */

import Joi from 'joi';
import { Errors } from './errors';

export class ValidationUtils {
  /**
   * 驗證陳述內容
   */
  static validateStatement(
    statement: string,
    fieldName: string = '陳述',
    minLength: number = 30,
    maxLength: number = 2000
  ): string {
    if (!statement || typeof statement !== 'string') {
      throw Errors.VALIDATION_ERROR(`${fieldName}不能為空`);
    }

    const trimmed = statement.trim();

    if (trimmed.length < minLength) {
      throw Errors.VALIDATION_ERROR(`${fieldName}長度必須至少${minLength}字`);
    }

    if (trimmed.length > maxLength) {
      throw Errors.VALIDATION_ERROR(`${fieldName}長度不能超過${maxLength}字`);
    }

    return trimmed;
  }

  /**
   * 驗證證據URL列表
   */
  static validateEvidenceUrls(urls: string[]): void {
    if (!Array.isArray(urls)) {
      throw Errors.VALIDATION_ERROR('證據URL必須是數組');
    }

    if (urls.length > 3) {
      throw Errors.TOO_MANY_FILES('最多只能上傳3張圖片');
    }

    urls.forEach((url, index) => {
      if (!url || typeof url !== 'string') {
        throw Errors.VALIDATION_ERROR(`證據URL[${index}]格式錯誤`);
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw Errors.VALIDATION_ERROR(`證據URL[${index}]格式無效`);
      }
      if (parsed.protocol !== 'https:') {
        throw Errors.VALIDATION_ERROR(`證據URL[${index}]僅支持 HTTPS`);
      }
    });
  }

  /**
   * 驗證UUID格式
   */
  static validateUUID(id: string, fieldName: string = 'ID'): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
      throw Errors.VALIDATION_ERROR(`${fieldName}格式無效`);
    }
  }

  /**
   * 驗證郵箱格式
   */
  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      throw Errors.INVALID_EMAIL('郵箱格式錯誤');
    }
  }

  /**
   * 驗證密碼強度
   */
  static validatePassword(password: string): void {
    if (!password || typeof password !== 'string') {
      throw Errors.WEAK_PASSWORD('密碼不能為空');
    }

    if (password.length < 8) {
      throw Errors.WEAK_PASSWORD('密碼長度至少8位');
    }

    if (!/[a-zA-Z]/.test(password)) {
      throw Errors.WEAK_PASSWORD('密碼必須包含字母');
    }

    if (!/[0-9]/.test(password)) {
      throw Errors.WEAK_PASSWORD('密碼必須包含數字');
    }
  }

  /**
   * 驗證責任分比例
   */
  static validateResponsibilityRatio(ratio: {
    plaintiff: number;
    defendant: number;
  }): void {
    if (!ratio || typeof ratio !== 'object') {
      throw Errors.VALIDATION_ERROR('責任分比例必須是數字');
    }
    if (
      typeof ratio.plaintiff !== 'number' ||
      typeof ratio.defendant !== 'number'
    ) {
      throw Errors.VALIDATION_ERROR('責任分比例必須是數字');
    }

    if (ratio.plaintiff < 0 || ratio.defendant < 0) {
      throw Errors.VALIDATION_ERROR('責任分比例不能為負數');
    }

    const total = ratio.plaintiff + ratio.defendant;
    if (Math.abs(total - 100) > 0.01) {
      throw Errors.VALIDATION_ERROR('責任分比例總和必須為100%');
    }
  }
}

// Joi Validation Schemas
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Auth Schemas
const passwordRule = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[a-zA-Z]/, 'letter')
  .pattern(/[0-9]/, 'digit')
  .required()
  .messages({
    'string.min': '密碼長度至少8位',
    'string.max': '密碼長度不能超過128位',
    'string.pattern.name': '密碼必須包含字母和數字',
  });

export const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: passwordRule,
    nickname: Joi.string().min(2).max(50).optional(),
  }),
};

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};

export const sendVerificationCodeSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    type: Joi.string().valid('register', 'reset_password', 'verify_email').required(),
  }),
};

export const verifyEmailSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).required(),
    type: Joi.string().valid('register', 'reset_password', 'verify_email').default('verify_email'),
  }),
};

export const resetPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
  }),
};

export const confirmResetPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).required(),
    new_password: passwordRule,
  }),
};

export const claimSessionSchema = {
  body: Joi.object({
    session_id: Joi.string().min(1).max(100).required(),
  }),
};

export const acceptJudgmentSchema = {
  body: Joi.object({
    accepted: Joi.boolean().required(),
    rating: Joi.number().integer().min(0).max(5).optional(),
  }),
};

export const repairJudgmentSchema = {
  body: Joi.object({
    feedback: Joi.string().trim().min(3).max(2000).required(),
  }),
};

export const judgmentMetricsSchema = {
  body: Joi.object({
    felt_understood: Joi.number().min(0).max(10).required(),
    felt_blamed: Joi.number().min(0).max(10).required(),
    willing_to_try: Joi.number().min(0).max(10).required(),
  }),
};

// Case Schemas
export const quickCaseSchema = {
  body: Joi.object({
    // 使用下劃線命名，與數據庫和服務層保持一致
    plaintiff_statement: Joi.string().min(30).max(2000).required(),
    defendant_statement: Joi.string().min(10).max(2000).optional().allow(null, ''),
    evidence_urls: Joi.array().items(Joi.string().uri({ scheme: ['https'] })).max(3).optional(),
  }),
};

export const createCaseSchema = {
  body: Joi.object({
    plaintiff_statement: Joi.string().min(30).max(2000).required(),
    defendant_statement: Joi.alternatives().conditional('mode', {
      is: 'collaborative',
      then: Joi.string().min(30).max(2000).required(),
      otherwise: Joi.string().min(30).max(2000).optional().allow(null, ''),
    }),
    evidence_urls: Joi.array().items(Joi.string().uri({ scheme: ['https'] })).max(3).optional(),
    pairing_id: Joi.string().pattern(uuidPattern).required(),
    title: Joi.string().max(200).optional().allow(null, ''),
    type: Joi.string().max(50).optional(),
    sub_type: Joi.string().max(50).optional(),
    mode: Joi.string().valid('remote', 'collaborative').optional().default('remote'),
    safety_assertion: Joi.alternatives().try(Joi.string().max(2000), Joi.object().max(20)).optional(),
    safetyAssertion: Joi.alternatives().try(Joi.string().max(2000), Joi.object().max(20)).optional(),
    contains_minor: Joi.boolean().optional(),
    contains_sensitive_content: Joi.boolean().optional(),
    contains_nonconsensual_content: Joi.boolean().optional(),
    contains_illegal_content: Joi.boolean().optional(),
    minor_guardian_or_self_upload_confirmed: Joi.boolean().optional(),
    sensitive_content_handling_ack: Joi.boolean().optional(),
  }),
};

export const collaborativeCaseSchema = {
  body: Joi.object({
    case_id: Joi.string().pattern(uuidPattern).optional(),
    plaintiff_statement: Joi.string().min(30).max(2000).optional(),
    defendant_statement: Joi.string().min(10).max(2000).optional(),
    evidence_urls: Joi.array().items(Joi.string().uri({ scheme: ['https'] })).max(3).optional(),
  }).or('plaintiff_statement', 'defendant_statement'),
};

export const updateCaseSchema = {
  body: Joi.object({
    title: Joi.string().max(200).optional().allow(null, ''),
    plaintiff_statement: Joi.string().min(30).max(2000).optional(),
    defendant_statement: Joi.string().min(30).max(2000).optional().allow(null, ''),
  }).min(1),
};

export const uuidParamSchema = {
  params: Joi.object({
    id: Joi.string().pattern(uuidPattern).required(),
    evidenceId: Joi.string().pattern(uuidPattern).optional(),
  }),
};

export const uuidEvidenceParamSchema = {
  params: Joi.object({
    id: Joi.string().pattern(uuidPattern).required(),
    evidenceId: Joi.string().pattern(uuidPattern).required(),
  }),
};

// Execution Schemas
export const confirmExecutionSchema = {
  body: Joi.object({
    plan_id: Joi.string().pattern(uuidPattern).required(),
  }),
};

export const executionStatusQuerySchema = {
  query: Joi.object({
    plan_id: Joi.string().pattern(uuidPattern).required(),
  }),
};

export const checkinSchema = {
  body: Joi.object({
    plan_id: Joi.string().pattern(uuidPattern).required(),
    notes: Joi.string().max(500).optional(),
    photos: Joi.array().items(Joi.string().uri()).max(3).optional(),
    step_result: Joi.string().valid('done', 'partial', 'skipped').optional(),
    closeness: Joi.string().valid('closer', 'same', 'farther').optional(),
    stress: Joi.string().valid('low', 'medium', 'high').optional(),
    needs_help: Joi.boolean().optional(),
  }),
};

// Pairing Schemas
export const createPairingSchema = {
  body: Joi.object({}).optional(),
};

export const joinPairingSchema = {
  body: Joi.object({
    invite_code: Joi.string().length(6).required(),
  }),
};

// Reconciliation Schemas
export const generateReconciliationPlansSchema = {
  body: Joi.object({
    intent: Joi.string().valid('repair', 'cool_down', 'graceful_exit', 'safety_support').optional(),
    preferences: Joi.object({
      difficulty: Joi.string().valid('easy', 'medium', 'hard').optional(),
      duration: Joi.number().integer().min(1).max(365).optional(),
      types: Joi.array().items(Joi.string().valid('activity', 'communication', 'intimacy', 'gift', 'service')).max(5).optional(),
      pressure_level: Joi.string().valid('low', 'medium', 'high').optional(),
      pace: Joi.string().valid('today', 'this_week', 'ease_in').optional(),
      style: Joi.array().items(Joi.string().valid('action', 'conversation', 'companionship', 'distance')).max(4).optional(),
      invite_partner: Joi.boolean().optional(),
    }).optional(),
    force_regenerate: Joi.boolean().optional(),
  }).optional(),
};

export const selectPlanSchema = {
  body: Joi.object({}).optional(),
};

export const invitePartnerSchema = {
  body: Joi.object({}).optional(),
};

export const respondPlanSchema = {
  body: Joi.object({
    action: Joi.string().valid('viewed', 'committed', 'deferred', 'declined', 'paused').required(),
    reason: Joi.string().valid('need_time', 'needs_space', 'unsure', 'too_much_pressure').optional(),
    remind_in_hours: Joi.number().integer().min(1).max(168).optional(),
  }),
};

export const uuidTrackParamSchema = {
  params: Joi.object({
    id: Joi.string().pattern(uuidPattern).required(),
  }),
};

export const replanTrackSchema = {
  body: Joi.object({
    mode: Joi.string().valid('lower_pressure', 'slower_pace', 'solo_first').required(),
    reason: Joi.string().valid('needs_help', 'farther', 'high_stress', 'manual').required(),
  }),
};

export const pairingIdParamSchema = {
  params: Joi.object({
    pairingId: Joi.string().pattern(uuidPattern).required(),
  }),
};

export const caseIdParamSchema = {
  params: Joi.object({
    caseId: Joi.string().pattern(uuidPattern).required(),
  }),
};

export const updateProfileSchema = {
  body: Joi.object({
    nickname: Joi.string().min(2).max(50).optional(),
    avatar_url: Joi.string().uri().optional(),
    gender: Joi.string().valid('male', 'female', 'other').optional(),
    age: Joi.number().integer().min(13).max(120).optional(),
    relationship_status: Joi.string().valid('single', 'dating', 'married').optional(),
    language: Joi.string().max(10).optional(),
    timezone: Joi.string().max(50).optional(),
    notification_enabled: Joi.boolean().optional(),
    privacy_level: Joi.string().valid('public', 'partner_only', 'private').optional(),
  }).min(1),
};

// Interview (v2.0) Schemas
export const interviewStartSchema = {
  body: Joi.object({
    trigger: Joi.string().valid('organic', 'pre_case', 'post_judgment', 'onboarding').optional(),
  }).optional(),
};

export const interviewRespondSchema = {
  body: Joi.object({
    message: Joi.string().min(1).max(2000).required(),
  }),
};

export const createNotificationSchema = {
  body: Joi.object({
    channel: Joi.string().valid('email', 'push').required(),
    template_code: Joi.string().max(50).required(),
    payload: Joi.object().max(20).optional(),
    dedup_key: Joi.string().max(100).optional(),
    action_key: Joi.string().max(50).optional(),
    priority: Joi.string().valid('now', 'soon', 'later').optional(),
    group_key: Joi.string().max(100).optional(),
  }),
};

export const notificationIdParamSchema = {
  params: Joi.object({
    id: Joi.string().pattern(uuidPattern).required(),
  }),
};

export const notificationListQuerySchema = {
  query: Joi.object({
    status: Joi.string().valid('pending', 'sent', 'failed').optional(),
    state: Joi.string().valid('unread', 'all', 'actionable', 'snoozed', 'archived').optional(),
    template_code: Joi.string().max(50).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
    cursor: Joi.string().pattern(uuidPattern).optional(),
  }),
};

export const notificationActSchema = {
  body: Joi.object({
    action_key: Joi.string().max(50).optional(),
  }).optional(),
};

export const notificationSnoozeSchema = {
  body: Joi.object({
    hours: Joi.number().integer().min(1).max(168).optional(),
  }).optional(),
};

export const createContentLinkSchema = {
  body: Joi.object({
    case_id: Joi.string().uuid().required(),
    content_id: Joi.string().uuid().required(),
    relation: Joi.string().valid('recommend', 'similar', 'waiting').optional(),
  }),
};

export const upsertUserProfileSchema = {
  body: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string().max(500),
      Joi.number(),
      Joi.boolean(),
      Joi.array().max(50).items(Joi.string().max(200)),
      Joi.object().max(20)
    )
  ).max(30),
};

export const upsertRelationshipProfileSchema = {
  body: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string().max(1000),
      Joi.number(),
      Joi.boolean(),
      Joi.array().max(100).items(Joi.alternatives().try(Joi.string().max(500), Joi.object().max(20))),
      Joi.object().max(20)
    )
  ).max(60),
};

// Admin Schemas
export const adminBootstrapSchema = {
  body: Joi.object({
    email: Joi.string().email().max(255).required(),
    password: Joi.string().min(10).max(128).required(),
    name: Joi.string().min(2).max(100).required(),
    roleKey: Joi.string().valid('super_admin', 'ops', 'marketing', 'support').optional(),
  }),
};

export const adminLoginSchema = {
  body: Joi.object({
    email: Joi.string().email().max(255).required(),
    password: Joi.string().min(1).max(128).required(),
  }),
};

export const adminUpsertConfigSchema = {
  body: Joi.object({
    key: Joi.string()
      .pattern(
        /^(jobs\.enabled|interview\.maxTurns|interview\.softTarget|interview\.turnIntervalMs|interview\.startRateLimit|interview\.dailySessionLimit|admin\.alert\.rules|feature\.flags|media\.providers|media\.provider\.[a-z0-9][a-z0-9_-]*)$/
      )
      .required(),
    value: Joi.alternatives().try(
      Joi.string().max(5000),
      Joi.number(),
      Joi.boolean(),
      Joi.array().max(200).items(Joi.alternatives().try(Joi.string().max(1000), Joi.number(), Joi.boolean(), Joi.object().max(50))),
      Joi.object().max(100)
    ).required(),
    description: Joi.string().max(500).allow('', null).optional(),
    isRuntime: Joi.boolean().optional(),
    isSensitive: Joi.boolean().optional(),
  }),
};

export const adminUserStatusSchema = {
  body: Joi.object({
    action: Joi.string().valid('lock', 'unlock', 'deactivate', 'activate').required(),
    lockMinutes: Joi.number().integer().min(1).max(60 * 24 * 14).optional(),
  }),
  params: Joi.object({
    userId: Joi.string().uuid().required(),
  }),
};

export const adminUserDetailParamSchema = {
  params: Joi.object({
    userId: Joi.string().uuid().required(),
  }),
};

export const adminAdminUserCreateSchema = {
  body: Joi.object({
    email: Joi.string().email().max(255).required(),
    password: Joi.string().min(10).max(128).required(),
    name: Joi.string().min(2).max(100).required(),
    roleKey: Joi.string().valid('super_admin', 'ops', 'marketing', 'support').required(),
  }),
};

export const adminAdminUserUpdateSchema = {
  params: Joi.object({
    adminUserId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    roleKey: Joi.string().valid('super_admin', 'ops', 'marketing', 'support').optional(),
    isActive: Joi.boolean().optional(),
    password: Joi.string().min(10).max(128).optional(),
  }).min(1),
};

export const adminAdminUserDeleteSchema = {
  params: Joi.object({
    adminUserId: Joi.string().uuid().required(),
  }),
};

export const adminJobTriggerSchema = {
  params: Joi.object({
    jobKey: Joi.string().max(100).required(),
  }),
};

export const adminJobStatsQuerySchema = {
  query: Joi.object({
    days: Joi.number().integer().min(1).max(90).optional(),
    includeRunning: Joi.boolean().optional(),
    maxRows: Joi.number().integer().min(100).max(20000).optional(),
  }),
};

export const adminAIStreamReportQuerySchema = {
  query: Joi.object({
    days: Joi.number().integer().min(1).max(90).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
  }),
};

export const adminAIStreamListQuerySchema = {
  query: Joi.object({
    days: Joi.number().integer().min(1).max(90).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
    status: Joi.string().valid('created', 'queued', 'started', 'streaming', 'completed', 'persisted', 'failed', 'cancelled').optional(),
    scopeType: Joi.string().max(50).optional(),
    scopeId: Joi.string().max(100).optional(),
    requestId: Joi.string().max(100).optional(),
    streamId: Joi.string().max(100).optional(),
    source: Joi.string().valid('live', 'archive', 'all').optional(),
  }),
};

export const adminAIStreamDetailSchema = {
  params: Joi.object({
    streamId: Joi.string().max(100).required(),
  }),
  query: Joi.object({
    eventLimit: Joi.number().integer().min(1).max(1000).optional(),
    source: Joi.string().valid('live', 'archive', 'all').optional(),
  }),
};

export const adminAuditLogsQuerySchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
    entityType: Joi.string().max(50).optional(),
    action: Joi.string().max(50).optional(),
    from: Joi.string().isoDate().optional(),
    to: Joi.string().isoDate().optional(),
  }),
};

export const adminPaginationQuerySchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),
};

export const adminSearchPaginationQuerySchema = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
    q: Joi.string().max(255).optional().allow(''),
  }),
};

export const adminCustomReportSchema = {
  body: Joi.object({
    metrics: Joi.array()
      .items(Joi.string().valid('dau', 'mau', 'judgment_failed'))
      .min(1)
      .max(20)
      .required(),
  }),
};

export const adminAlertRulesSchema = {
  body: Joi.object({
    rules: Joi.array()
      .items(Joi.object().unknown(true))
      .max(200)
      .required(),
  }),
};

export const adminFeatureFlagsSchema = {
  body: Joi.object({
    flags: Joi.object().unknown(true).required(),
  }),
};

export const mediaProviderTestSchema = {
  params: Joi.object({
    providerKey: Joi.string().pattern(/^[a-z0-9][a-z0-9_-]*$/).required(),
  }),
  body: Joi.object({
    api_key: Joi.string().trim().allow('').optional(),
    apiKey: Joi.string().trim().allow('').optional(),
    base_url: Joi.string().uri().optional(),
    baseUrl: Joi.string().uri().optional(),
    timeout_ms: Joi.number().integer().min(500).max(120000).optional(),
    timeoutMs: Joi.number().integer().min(500).max(120000).optional(),
    model: Joi.string().max(128).optional(),
    count: Joi.number().integer().min(1).max(20).optional(),
    durationSeconds: Joi.number().integer().min(1).max(240).optional(),
    source_image_url: Joi.string().uri().optional(),
    sourceImageUrl: Joi.string().uri().optional(),
    prompt: Joi.string().max(2048).optional(),
  }),
};

const mediaProviderBaseGenerationSchema = {
  params: Joi.object({
    providerKey: Joi.string().pattern(/^[a-z0-9][a-z0-9_-]*$/).required(),
  }),
  body: Joi.object({
    api_key: Joi.string().trim().allow('').optional(),
    apiKey: Joi.string().trim().allow('').optional(),
    base_url: Joi.string().uri().optional(),
    baseUrl: Joi.string().uri().optional(),
    timeout_ms: Joi.number().integer().min(500).max(120000).optional(),
    timeoutMs: Joi.number().integer().min(500).max(120000).optional(),
    model: Joi.string().max(128).optional(),
    prompt: Joi.string().max(2048).required(),
  }),
};

export const mediaProviderGenerateImageSchema = {
  ...mediaProviderBaseGenerationSchema,
  body: (mediaProviderBaseGenerationSchema.body as Joi.ObjectSchema).append({
    count: Joi.number().integer().min(1).max(20).optional(),
    width: Joi.number().integer().min(16).max(8192).optional(),
    height: Joi.number().integer().min(16).max(8192).optional(),
  }),
};

export const mediaProviderGenerateVideoSchema = {
  ...mediaProviderBaseGenerationSchema,
  body: (mediaProviderBaseGenerationSchema.body as Joi.ObjectSchema).append({
    durationSeconds: Joi.number().integer().min(1).max(240).optional(),
    source_image_url: Joi.string().uri().optional(),
    sourceImageUrl: Joi.string().uri().optional(),
  }),
};

export const mediaProviderEstimateSchema = {
  params: Joi.object({
    providerKey: Joi.string().pattern(/^[a-z0-9][a-z0-9_-]*$/).required(),
  }),
  body: Joi.object({
    count: Joi.number().integer().min(1).optional(),
    durationSeconds: Joi.number().integer().min(1).max(86400).optional(),
    pricingOverride: Joi.object({
      billingUnit: Joi.string().valid('image', 'second', 'frame').required(),
      unitPriceUsd: Joi.number().min(0).required(),
    }).optional(),
  }),
};

export const mediaProviderCatalogQuerySchema = {
  query: Joi.object({
    providerType: Joi.string().valid('image', 'video').optional(),
  }).optional(),
};

const chatRoomIdPattern = Joi.string().pattern(uuidPattern);
const chatVisibilityModeRule = Joi.string().valid(
  'share_full_history',
  'share_summary_only',
  'share_from_join_time'
);

export const createChatRoomSchema = {
  body: Joi.object({
    history_visibility_mode: chatVisibilityModeRule.optional(),
  }),
};

export const chatRoomIdParamSchema = {
  params: Joi.object({
    roomId: chatRoomIdPattern.required(),
  }),
};

export const createChatInviteSchema = {
  body: Joi.object({
    history_visibility_mode: chatVisibilityModeRule.optional(),
    expires_in_hours: Joi.number().integer().min(1).max(168).optional(),
  }),
};

export const acceptChatInviteSchema = {
  params: Joi.object({
    inviteCode: Joi.string().alphanum().min(6).max(12).required(),
  }),
};

export const listChatMessagesSchema = {
  query: Joi.object({
    cursor: Joi.string().isoDate().optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};

export const sendChatMessageSchema = {
  body: Joi.object({
    content: Joi.string().trim().min(1).max(4000).required(),
    visibility_scope: Joi.string().valid('all', 'owner_only', 'summary_only').optional(),
    reply_to_message_id: Joi.string().uuid().optional(),
  }),
};

export const requestChatJudgmentSchema = {
  body: Joi.object({
    included_message_ids: Joi.array().items(Joi.string().uuid()).min(1).optional(),
    participant_consent: Joi.object({
      role_b_included_messages: Joi.boolean().valid(true).optional(),
    }).optional(),
  }).optional(),
};
