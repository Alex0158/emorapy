import type { Prisma } from '@prisma/client';
import type {
  ContextAudience,
  ContextAuthorizationRef,
  ContextPurpose,
  ContextSourceRef,
  ContextTargetType,
} from '@emorapy/contracts/chat';
import { Errors } from '../utils/errors';
import { CHAT_CONTEXT_POLICY_VERSION, assertSha256 } from '../utils/chat-context-validation';

export type ContextUseAuditWrite = {
  roomId: string;
  actorParticipantId: string;
  analysisRequestId?: string;
  capsuleId?: string;
  authorizationId?: string;
  purpose: ContextPurpose;
  audience: ContextAudience;
  targetType: ContextTargetType;
  targetId: string;
  decision: 'allowed' | 'denied';
  reasonCode: string;
  sourceRefs: ContextSourceRef[];
  authorizationRefs?: ContextAuthorizationRef[];
  contentHashes: string[];
};

function sanitizeSourceRefs(sourceRefs: ContextSourceRef[]): ContextSourceRef[] {
  return sourceRefs.map(ref => {
    if (!ref.id || !ref.content_hash) {
      throw Errors.CONFLICT('Context audit source ref 缺少 ID 或 hash');
    }
    assertSha256(ref.content_hash, 'context audit source hash');
    return {
      kind: ref.kind,
      id: ref.id,
      ...(ref.version === undefined ? {} : { version: ref.version }),
      content_hash: ref.content_hash,
    };
  });
}

function sanitizeAuthorizationRefs(
  authorizationRefs: ContextAuthorizationRef[]
): ContextAuthorizationRef[] {
  return authorizationRefs.map(ref => {
    if (!ref.id || !ref.capsule_id) {
      throw Errors.CONFLICT('Context audit authorization ref 缺少 ID');
    }
    assertSha256(ref.capsule_content_hash, 'context audit authorization hash');
    return {
      id: ref.id,
      capsule_id: ref.capsule_id,
      capsule_content_hash: ref.capsule_content_hash,
    };
  });
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function writeContextUseAudit(
  tx: Prisma.TransactionClient,
  input: ContextUseAuditWrite
): Promise<void> {
  if (!/^[a-z0-9_]{1,100}$/.test(input.reasonCode)) {
    throw Errors.CONFLICT('Context audit reason code 無效');
  }
  if (!input.targetId) {
    throw Errors.CONFLICT('Context audit target ID 遺失');
  }
  input.contentHashes.forEach(hash => assertSha256(hash, 'context audit content hash'));

  await tx.contextUseAudit.create({
    data: {
      room_id: input.roomId,
      actor_participant_id: input.actorParticipantId,
      analysis_request_id: input.analysisRequestId,
      capsule_id: input.capsuleId,
      authorization_id: input.authorizationId,
      purpose: input.purpose,
      audience: input.audience,
      target_type: input.targetType,
      target_id: input.targetId,
      decision: input.decision,
      reason_code: input.reasonCode,
      source_refs: toInputJson(sanitizeSourceRefs(input.sourceRefs)),
      authorization_refs: toInputJson(sanitizeAuthorizationRefs(input.authorizationRefs ?? [])),
      content_hashes: [...input.contentHashes],
      policy_version: CHAT_CONTEXT_POLICY_VERSION,
    },
  });
}
