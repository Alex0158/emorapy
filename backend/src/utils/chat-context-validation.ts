import crypto from 'node:crypto';
import Joi from 'joi';
import { Errors } from './errors';

export const CHAT_CONTEXT_POLICY_VERSION = '2026-07-12.v1';
export const CAPSULE_DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CAPSULE_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ANALYSIS_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const CONTEXT_PURPOSES = [
  'private_support',
  'shared_mediation',
  'formal_analysis_evidence',
  'formal_analysis_delivery',
  'future_private_support',
  'future_joint_support',
  'solo_repair',
  'joint_repair',
  'safety_routing',
] as const;

const CONTEXT_AUDIENCES = [
  'private_owner',
  'room_participants',
  'analysis_participants',
  'pairing_participants',
  'safety_system',
] as const;

const CONTEXT_TARGET_TYPES = [
  'user',
  'chat_room',
  'case',
  'pairing',
  'analysis_request',
  'repair_track',
] as const;

const PURPOSE_AUDIENCE: Readonly<
  Record<(typeof CONTEXT_PURPOSES)[number], (typeof CONTEXT_AUDIENCES)[number]>
> = {
  private_support: 'private_owner',
  shared_mediation: 'room_participants',
  formal_analysis_evidence: 'analysis_participants',
  formal_analysis_delivery: 'analysis_participants',
  future_private_support: 'private_owner',
  future_joint_support: 'pairing_participants',
  solo_repair: 'private_owner',
  joint_repair: 'pairing_participants',
  safety_routing: 'safety_system',
};

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function normalizeCanonicalValue(value: unknown): CanonicalValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw Errors.VALIDATION_ERROR('Canonical payload 包含非有限數字');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeCanonicalValue);
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw Errors.VALIDATION_ERROR('Canonical payload 只接受 plain object');
    }
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<{ [key: string]: CanonicalValue }>((result, key) => {
        const item = record[key];
        if (item === undefined) {
          throw Errors.VALIDATION_ERROR('Canonical payload 不接受 undefined');
        }
        result[key] = normalizeCanonicalValue(item);
        return result;
      }, {});
  }
  throw Errors.VALIDATION_ERROR('Canonical payload 包含不支援的資料類型');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value));
}

export function canonicalSha256(value: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function computeCapsuleContentHash(input: {
  expiresAt: Date;
  lineageId: string;
  ownerParticipantId: string;
  policyVersion: string;
  roomId: string;
  sourceChannelId: string;
  sourceRefs: unknown;
  summary: string;
  version: number;
}): string {
  return canonicalSha256({
    expires_at: input.expiresAt.toISOString(),
    lineage_id: input.lineageId,
    owner_participant_id: input.ownerParticipantId,
    policy_version: input.policyVersion,
    room_id: input.roomId,
    source_channel_id: input.sourceChannelId,
    source_refs: input.sourceRefs,
    summary: input.summary,
    version: input.version,
  });
}

export function computeAnalysisSelectionHash(input: {
  policyVersion: string;
  requiredParticipantIds: readonly string[];
  roomId: string;
  selectionSnapshot: unknown;
}): string {
  return canonicalSha256({
    policy_version: input.policyVersion,
    required_participant_ids: [...input.requiredParticipantIds].sort(),
    room_id: input.roomId,
    selection_snapshot: input.selectionSnapshot,
  });
}

export function textSha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function normalizeUniqueIds(
  values: readonly string[],
  fieldName: string,
  max = 100
): string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > max) {
    throw Errors.VALIDATION_ERROR(`${fieldName} 必須包含 1-${max} 個 ID`);
  }
  const normalized = [...new Set(values)];
  if (normalized.length !== values.length || normalized.some(value => !UUID_PATTERN.test(value))) {
    throw Errors.VALIDATION_ERROR(`${fieldName} 包含重複或無效 ID`);
  }
  return normalized.sort();
}

export function normalizeOptionalIds(
  values: readonly string[] | undefined,
  fieldName: string,
  max = 100
): string[] {
  if (values === undefined || values.length === 0) return [];
  return normalizeUniqueIds(values, fieldName, max);
}

export function normalizeCapsuleSummary(summary: string): string {
  const normalized = summary.trim().normalize('NFC');
  if (normalized.length === 0 || normalized.length > 2000) {
    throw Errors.VALIDATION_ERROR('Capsule 內容長度必須為 1-2000 字');
  }
  return normalized;
}

export function assertSha256(value: string, fieldName: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw Errors.VALIDATION_ERROR(`${fieldName} 必須是 lowercase SHA-256`);
  }
}

export function assertCurrentPolicyVersion(policyVersion: string): void {
  if (policyVersion !== CHAT_CONTEXT_POLICY_VERSION) {
    throw Errors.CONFLICT('Context policy version 已更新，請重新載入');
  }
}

export function assertPurposeAudience(purpose: string, audience: string): void {
  if (!(purpose in PURPOSE_AUDIENCE)) {
    throw Errors.VALIDATION_ERROR('不支援的 context purpose');
  }
  const expectedAudience = PURPOSE_AUDIENCE[purpose as keyof typeof PURPOSE_AUDIENCE];
  if (audience !== expectedAudience) {
    throw Errors.FORBIDDEN('Context purpose 與 audience 不相容');
  }
}

export function resolveFutureExpiry(
  requestedExpiry: string | null | undefined,
  now: Date,
  defaultTtlMs: number,
  maxTtlMs: number,
  upperBound?: Date | null
): Date {
  const maxExpiry = new Date(now.getTime() + maxTtlMs);
  const effectiveUpperBound = upperBound && upperBound < maxExpiry ? upperBound : maxExpiry;
  const expiry = requestedExpiry
    ? new Date(requestedExpiry)
    : new Date(Math.min(now.getTime() + defaultTtlMs, effectiveUpperBound.getTime()));
  if (Number.isNaN(expiry.getTime()) || expiry <= now) {
    throw Errors.VALIDATION_ERROR('到期時間必須晚於現在');
  }
  if (expiry > effectiveUpperBound) {
    throw Errors.VALIDATION_ERROR('到期時間超出允許範圍');
  }
  return expiry;
}

export function isActiveAt(expiresAt: Date | null, revokedAt: Date | null, now: Date): boolean {
  return revokedAt === null && expiresAt !== null && expiresAt > now;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export function isTransactionWriteConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2034'
  );
}

export function selectionSnapshotMayReferenceCapsule(value: unknown, capsuleId: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  const capsuleRefs = (value as Record<string, unknown>).capsule_refs;
  if (!Array.isArray(capsuleRefs)) return true;
  return capsuleRefs.some(ref => {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return true;
    const record = ref as Record<string, unknown>;
    return typeof record.id !== 'string' || record.id === capsuleId;
  });
}

const uuid = Joi.string().pattern(UUID_PATTERN);
const sha256 = Joi.string().pattern(SHA256_PATTERN);

export const chatContextRoomParamsSchema = {
  params: Joi.object({ roomId: uuid.required() }),
};

export const chatContextCapsuleParamsSchema = {
  params: Joi.object({ roomId: uuid.required(), capsuleId: uuid.required() }),
};

export const chatContextAuthorizationParamsSchema = {
  params: Joi.object({ roomId: uuid.required(), authorizationId: uuid.required() }),
};

export const chatAnalysisRequestParamsSchema = {
  params: Joi.object({ roomId: uuid.required(), requestId: uuid.required() }),
};

export const createContextCapsuleSchema = {
  body: Joi.object({
    source_channel_id: uuid.required(),
    source_message_ids: Joi.array().items(uuid.required()).min(1).max(50).unique().required(),
    summary: Joi.string().trim().min(1).max(2000).required(),
    expires_at: Joi.string().isoDate().optional().allow(null),
  }),
};

export const grantContextAuthorizationSchema = {
  body: Joi.object({
    capsule_content_hash: sha256.required(),
    purpose: Joi.string()
      .valid(...CONTEXT_PURPOSES)
      .required(),
    audience: Joi.string()
      .valid(...CONTEXT_AUDIENCES)
      .required(),
    target_type: Joi.string()
      .valid(...CONTEXT_TARGET_TYPES)
      .required(),
    target_id: uuid.required(),
    policy_version: Joi.string().max(50).required(),
    expires_at: Joi.string().isoDate().optional().allow(null),
  }),
};

export const revokeContextAuthorizationSchema = {
  body: Joi.object({
    reason_code: Joi.string().valid('user_revoked').required(),
  }),
};

export const createChatAnalysisRequestSchema = {
  body: Joi.object({
    selected_message_ids: Joi.array().items(uuid).max(100).unique().required(),
    selected_capsule_ids: Joi.array().items(uuid).max(50).unique().required(),
  }),
};

export const decideChatAnalysisRequestSchema = {
  body: Joi.object({
    selection_hash: sha256.required(),
    decision: Joi.string().valid('approved', 'declined').required(),
    policy_version: Joi.string().max(50).required(),
  }),
};

export const revokeChatAnalysisApprovalSchema = {
  body: Joi.object({
    selection_hash: sha256.required(),
    policy_version: Joi.string().max(50).required(),
  }),
};
