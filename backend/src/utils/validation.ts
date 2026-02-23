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
    defendant_statement: Joi.string().min(30).max(2000).optional().allow(null, ''),
    evidence_urls: Joi.array().items(Joi.string().uri({ scheme: ['https'] })).max(3).optional(),
    pairing_id: Joi.string().pattern(uuidPattern).required(),
    title: Joi.string().max(200).optional().allow(null, ''),
    type: Joi.string().max(50).optional(),
    sub_type: Joi.string().max(50).optional(),
    mode: Joi.string().valid('remote', 'collaborative').optional().default('remote'),
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
    preferences: Joi.object({
      difficulty: Joi.string().valid('easy', 'medium', 'hard').optional(),
      duration: Joi.number().integer().min(1).max(365).optional(),
      types: Joi.array().items(Joi.string().valid('activity', 'communication', 'intimacy')).max(3).optional(),
    }).optional(),
  }).optional(),
};

export const selectPlanSchema = {
  body: Joi.object({}).optional(),
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
  }),
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
