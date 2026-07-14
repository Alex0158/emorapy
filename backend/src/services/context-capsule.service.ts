import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ContextPurpose,
  ContextSourceRef,
  CreateContextCapsuleInput,
  GrantContextAuthorizationInput,
  RevokeContextAuthorizationInput,
} from '@emorapy/contracts/chat';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import {
  CAPSULE_DEFAULT_TTL_MS,
  CAPSULE_MAX_TTL_MS,
  CHAT_CONTEXT_POLICY_VERSION,
  assertCurrentPolicyVersion,
  assertPurposeAudience,
  assertSha256,
  computeCapsuleContentHash,
  isTransactionWriteConflict,
  isUniqueConstraintError,
  normalizeCapsuleSummary,
  normalizeUniqueIds,
  resolveFutureExpiry,
  selectionSnapshotMayReferenceCapsule,
  textSha256,
} from '../utils/chat-context-validation';
import {
  ChatActorAccessService,
  chatActorAccessService,
  type ChatActorContext,
} from './chat-actor-access.service';
import {
  ChatSafetyRouterService,
  chatSafetyRouterService,
} from './chat-safety-router.service';
import { writeContextUseAudit } from './chat-context-audit.repository';

type Clock = () => Date;
type ActorAccess = Pick<ChatActorAccessService, 'resolveActiveHumanParticipant'>;
type SafetyRouter = Pick<ChatSafetyRouterService, 'assertFormalAnalysisAllowed'>;

type CapsuleDraftBuild = {
  sourceRefs: ContextSourceRef[];
  sourceContentHashes: string[];
  summary: string;
  expiresAt: Date;
  contentHash: string;
};

const CAPSULE_SOURCE_MESSAGE_TYPES = [
  'user_text',
  'ai_reflection',
  'ai_mediation',
  'ai_summary',
] as const;

const CHAT_ROOM_GRANT_PURPOSES = new Set<ContextPurpose>([
  'private_support',
  'shared_mediation',
  'formal_analysis_evidence',
  'formal_analysis_delivery',
  'safety_routing',
]);

const SERIALIZABLE_WRITE_CONFLICT = Symbol('context-serializable-write-conflict');
type SerializableWriteConflict = Error & { [SERIALIZABLE_WRITE_CONFLICT]: true };

function isSerializableWriteConflict(error: unknown): error is SerializableWriteConflict {
  const candidate = error as (Error & { [SERIALIZABLE_WRITE_CONFLICT]?: true });
  return (
    error instanceof Error
    && candidate[SERIALIZABLE_WRITE_CONFLICT] === true
  );
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class ContextCapsuleService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly actorAccess: ActorAccess = chatActorAccessService,
    private readonly clock: Clock = () => new Date(),
    private readonly safetyRouter: SafetyRouter = chatSafetyRouterService,
  ) {}

  private async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.db.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (isTransactionWriteConflict(error)) {
        const conflict = Errors.CONFLICT('Context 狀態正被另一請求更新，請重新載入');
        Object.defineProperty(conflict, SERIALIZABLE_WRITE_CONFLICT, { value: true });
        throw conflict;
      }
      throw error;
    }
  }

  private async cancelRequestsUsingCapsule(
    tx: Prisma.TransactionClient,
    roomId: string,
    capsuleId: string,
    now: Date
  ): Promise<void> {
    const candidates = await tx.chatAnalysisRequest.findMany({
      where: {
        room_id: roomId,
        status: { in: ['pending_approval', 'approved', 'submitted'] },
      },
      select: { id: true, selection_snapshot: true },
    });
    const affectedIds = candidates
      .filter(candidate =>
        selectionSnapshotMayReferenceCapsule(candidate.selection_snapshot, capsuleId)
      )
      .map(candidate => candidate.id);
    if (affectedIds.length === 0) return;
    await tx.chatAnalysisRequest.updateMany({
      where: {
        id: { in: affectedIds },
        status: { in: ['pending_approval', 'approved', 'submitted'] },
      },
      data: { status: 'cancelled', cancelled_at: now },
    });
  }

  private async recoverExactActiveAuthorization(
    roomId: string,
    capsuleId: string,
    actor: ChatActorContext,
    input: GrantContextAuthorizationInput,
    now: Date
  ) {
    const { participant } = await this.actorAccess.resolveActiveHumanParticipant(roomId, actor);
    const existing = await this.db.contextAuthorization.findFirst({
      where: {
        capsule_id: capsuleId,
        subject_participant_id: participant.id,
        purpose: input.purpose,
        audience: input.audience,
        target_type: input.target_type,
        target_id: input.target_id,
        capsule_content_hash: input.capsule_content_hash,
        policy_version: input.policy_version,
        revoked_at: null,
        expires_at: { gt: now },
        capsule: {
          room_id: roomId,
          owner_participant_id: participant.id,
          content_hash: input.capsule_content_hash,
          policy_version: input.policy_version,
          status: 'approved',
          revoked_at: null,
          expires_at: { gt: now },
        },
      },
    });
    if (
      !existing ||
      existing.revoked_at !== null ||
      !existing.expires_at ||
      existing.expires_at <= now
    ) {
      return null;
    }
    return existing;
  }

  private async buildDraft(
    tx: Prisma.TransactionClient,
    roomId: string,
    ownerParticipantId: string,
    input: CreateContextCapsuleInput,
    lineageId: string,
    version: number,
    now: Date
  ): Promise<CapsuleDraftBuild> {
    const sourceMessageIds = normalizeUniqueIds(input.source_message_ids, 'source_message_ids', 50);
    const summary = normalizeCapsuleSummary(input.summary);

    const sourceChannel = await tx.chatChannel.findFirst({
      where: {
        id: input.source_channel_id,
        room_id: roomId,
        kind: 'private',
        owner_participant_id: ownerParticipantId,
      },
      select: { id: true },
    });
    if (!sourceChannel) {
      throw Errors.FORBIDDEN('Capsule 只能使用本人的 private channel');
    }

    const messages = await tx.chatMessage.findMany({
      where: {
        id: { in: sourceMessageIds },
        room_id: roomId,
        channel_id: sourceChannel.id,
        ai_context_eligible: true,
        message_type: { in: [...CAPSULE_SOURCE_MESSAGE_TYPES] },
        safety_flag: false,
      },
      select: { id: true, content: true },
    });
    if (messages.length !== sourceMessageIds.length) {
      throw Errors.FORBIDDEN('部分 Capsule 來源不可見或不可分享');
    }

    const sourceRefs: ContextSourceRef[] = messages
      .map(message => ({
        kind: 'chat_message' as const,
        id: message.id,
        content_hash: textSha256(message.content),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const expiresAt = resolveFutureExpiry(
      input.expires_at,
      now,
      CAPSULE_DEFAULT_TTL_MS,
      CAPSULE_MAX_TTL_MS
    );
    const contentHash = computeCapsuleContentHash({
      expiresAt,
      lineageId,
      ownerParticipantId,
      policyVersion: CHAT_CONTEXT_POLICY_VERSION,
      roomId,
      sourceChannelId: sourceChannel.id,
      sourceRefs,
      summary,
      version,
    });

    return {
      sourceRefs,
      sourceContentHashes: sourceRefs.map(ref => {
        if (!ref.content_hash) {
          throw Errors.CONFLICT('Capsule source hash 遺失');
        }
        return ref.content_hash;
      }),
      summary,
      expiresAt,
      contentHash,
    };
  }

  async createDraft(roomId: string, actor: ChatActorContext, input: CreateContextCapsuleInput) {
    const now = this.clock();
    return this.transaction(async tx => {
      const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
        roomId,
        actor,
        tx
      );
      const lineageId = crypto.randomUUID();
      const draft = await this.buildDraft(tx, roomId, participant.id, input, lineageId, 1, now);
      const capsule = await tx.contextCapsule.create({
        data: {
          room_id: roomId,
          owner_participant_id: participant.id,
          source_channel_id: input.source_channel_id,
          lineage_id: lineageId,
          version: 1,
          summary: draft.summary,
          source_refs: toInputJson(draft.sourceRefs),
          content_hash: draft.contentHash,
          policy_version: CHAT_CONTEXT_POLICY_VERSION,
          sensitivity_class: 'sensitive',
          status: 'draft',
          expires_at: draft.expiresAt,
        },
      });
      await writeContextUseAudit(tx, {
        roomId,
        actorParticipantId: participant.id,
        capsuleId: capsule.id,
        purpose: 'private_support',
        audience: 'private_owner',
        targetType: 'chat_room',
        targetId: roomId,
        decision: 'allowed',
        reasonCode: 'capsule_draft_created',
        sourceRefs: draft.sourceRefs,
        contentHashes: [...draft.sourceContentHashes, capsule.content_hash],
      });
      return capsule;
    });
  }

  async reviseDraft(
    roomId: string,
    capsuleId: string,
    actor: ChatActorContext,
    input: CreateContextCapsuleInput
  ) {
    const now = this.clock();
    try {
      return await this.transaction(async tx => {
        const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx
        );
        const previous = await tx.contextCapsule.findFirst({
          where: {
            id: capsuleId,
            room_id: roomId,
            owner_participant_id: participant.id,
          },
        });
        if (!previous) {
          throw Errors.FORBIDDEN('你不能修改此 Capsule');
        }
        if (
          !['draft', 'approved'].includes(previous.status) ||
          previous.revoked_at ||
          !previous.expires_at ||
          previous.expires_at <= now
        ) {
          throw Errors.CONFLICT('Capsule 已失效，不能建立新版本');
        }
        const previousHash = computeCapsuleContentHash({
          expiresAt: previous.expires_at,
          lineageId: previous.lineage_id,
          ownerParticipantId: previous.owner_participant_id,
          policyVersion: previous.policy_version,
          roomId: previous.room_id,
          sourceChannelId: previous.source_channel_id,
          sourceRefs: previous.source_refs,
          summary: previous.summary,
          version: previous.version,
        });
        if (previousHash !== previous.content_hash) {
          throw Errors.CONFLICT('Capsule canonical hash 驗證失敗');
        }

        const nextVersion = previous.version + 1;
        const draft = await this.buildDraft(
          tx,
          roomId,
          participant.id,
          input,
          previous.lineage_id,
          nextVersion,
          now
        );
        const revoked = await tx.contextCapsule.updateMany({
          where: {
            id: previous.id,
            content_hash: previous.content_hash,
            policy_version: previous.policy_version,
            status: { in: ['draft', 'approved'] },
            revoked_at: null,
          },
          data: { status: 'revoked', revoked_at: now },
        });
        if (revoked.count !== 1) {
          throw Errors.CONFLICT('Capsule 版本已變更，請重新載入');
        }
        await tx.contextAuthorization.updateMany({
          where: { capsule_id: previous.id, revoked_at: null },
          data: { revoked_at: now, revocation_reason_code: 'capsule_superseded' },
        });
        await this.cancelRequestsUsingCapsule(tx, roomId, previous.id, now);

        const capsule = await tx.contextCapsule.create({
          data: {
            room_id: roomId,
            owner_participant_id: participant.id,
            source_channel_id: input.source_channel_id,
            lineage_id: previous.lineage_id,
            version: nextVersion,
            summary: draft.summary,
            source_refs: toInputJson(draft.sourceRefs),
            content_hash: draft.contentHash,
            policy_version: CHAT_CONTEXT_POLICY_VERSION,
            sensitivity_class: 'sensitive',
            status: 'draft',
            expires_at: draft.expiresAt,
          },
        });
        await writeContextUseAudit(tx, {
          roomId,
          actorParticipantId: participant.id,
          capsuleId: capsule.id,
          purpose: 'private_support',
          audience: 'private_owner',
          targetType: 'chat_room',
          targetId: roomId,
          decision: 'allowed',
          reasonCode: 'capsule_revision_created',
          sourceRefs: draft.sourceRefs,
          contentHashes: [...draft.sourceContentHashes, capsule.content_hash],
        });
        return capsule;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw Errors.CONFLICT('Capsule 新版本已由另一請求建立');
      }
      throw error;
    }
  }

  async grantAuthorization(
    roomId: string,
    capsuleId: string,
    actor: ChatActorContext,
    input: GrantContextAuthorizationInput
  ) {
    assertSha256(input.capsule_content_hash, 'capsule_content_hash');
    assertCurrentPolicyVersion(input.policy_version);
    assertPurposeAudience(input.purpose, input.audience);
    if (
      !CHAT_ROOM_GRANT_PURPOSES.has(input.purpose) ||
      input.target_type !== 'chat_room' ||
      input.target_id !== roomId
    ) {
      throw Errors.FORBIDDEN('此階段只允許當前聊天室的 purpose-scoped authorization');
    }

    const now = this.clock();
    try {
      return await this.transaction(async tx => {
        const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx
        );
        if (input.purpose === 'formal_analysis_evidence') {
          await this.safetyRouter.assertFormalAnalysisAllowed(roomId, tx);
        }
        const capsule = await tx.contextCapsule.findFirst({
          where: {
            id: capsuleId,
            room_id: roomId,
            owner_participant_id: participant.id,
          },
        });
        if (!capsule) {
          throw Errors.FORBIDDEN('你不能批准此 Capsule');
        }
        if (
          capsule.content_hash !== input.capsule_content_hash ||
          capsule.policy_version !== input.policy_version
        ) {
          throw Errors.CONFLICT('Capsule 內容或 policy version 已變更');
        }
        if (
          !['draft', 'approved'].includes(capsule.status) ||
          capsule.revoked_at ||
          !capsule.expires_at ||
          capsule.expires_at <= now
        ) {
          throw Errors.CONFLICT('Capsule 已失效，不能批准');
        }
        const recalculatedHash = computeCapsuleContentHash({
          expiresAt: capsule.expires_at,
          lineageId: capsule.lineage_id,
          ownerParticipantId: capsule.owner_participant_id,
          policyVersion: capsule.policy_version,
          roomId: capsule.room_id,
          sourceChannelId: capsule.source_channel_id,
          sourceRefs: capsule.source_refs,
          summary: capsule.summary,
          version: capsule.version,
        });
        if (recalculatedHash !== capsule.content_hash) {
          throw Errors.CONFLICT('Capsule canonical hash 驗證失敗');
        }
        const expiresAt = resolveFutureExpiry(
          input.expires_at,
          now,
          CAPSULE_DEFAULT_TTL_MS,
          CAPSULE_MAX_TTL_MS,
          capsule.expires_at
        );
        const activated = await tx.contextCapsule.updateMany({
          where: {
            id: capsule.id,
            content_hash: input.capsule_content_hash,
            policy_version: input.policy_version,
            status: { in: ['draft', 'approved'] },
            revoked_at: null,
          },
          data: { status: 'approved' },
        });
        if (activated.count !== 1) {
          throw Errors.CONFLICT('Capsule 版本已變更，請重新載入');
        }

        await tx.contextAuthorization.updateMany({
          where: {
            capsule_id: capsule.id,
            subject_participant_id: participant.id,
            purpose: input.purpose,
            audience: input.audience,
            target_type: input.target_type,
            target_id: input.target_id,
            capsule_content_hash: input.capsule_content_hash,
            policy_version: input.policy_version,
            revoked_at: null,
            OR: [{ expires_at: null }, { expires_at: { lte: now } }],
          },
          data: {
            revoked_at: now,
            revocation_reason_code: 'authorization_expired',
          },
        });

        const authorization = await tx.contextAuthorization.create({
          data: {
            capsule_id: capsule.id,
            subject_participant_id: participant.id,
            purpose: input.purpose,
            audience: input.audience,
            target_type: input.target_type,
            target_id: input.target_id,
            capsule_content_hash: input.capsule_content_hash,
            policy_version: input.policy_version,
            expires_at: expiresAt,
          },
        });
        const sourceRefs = [
          {
            kind: 'context_capsule' as const,
            id: capsule.id,
            version: capsule.version,
            content_hash: capsule.content_hash,
          },
        ];
        await writeContextUseAudit(tx, {
          roomId,
          actorParticipantId: participant.id,
          capsuleId: capsule.id,
          authorizationId: authorization.id,
          purpose: input.purpose,
          audience: input.audience,
          targetType: 'chat_room',
          targetId: roomId,
          decision: 'allowed',
          reasonCode: 'context_authorization_granted',
          sourceRefs,
          authorizationRefs: [
            {
              id: authorization.id,
              capsule_id: capsule.id,
              capsule_content_hash: capsule.content_hash,
            },
          ],
          contentHashes: [capsule.content_hash],
        });
        return authorization;
      });
    } catch (error) {
      const isConcurrentConflict = (
        isUniqueConstraintError(error) || isSerializableWriteConflict(error)
      );
      if (!isConcurrentConflict) throw error;

      const existing = await this.recoverExactActiveAuthorization(
        roomId,
        capsuleId,
        actor,
        input,
        now
      );
      if (existing) return existing;
      if (isUniqueConstraintError(error)) {
        throw Errors.CONFLICT('相同範圍的 active authorization 已存在，請重新載入');
      }
      throw error;
    }
  }

  async discardCapsule(
    roomId: string,
    capsuleId: string,
    actor: ChatActorContext
  ) {
    const now = this.clock();
    return this.transaction(async tx => {
      const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
        roomId,
        actor,
        tx
      );
      const capsule = await tx.contextCapsule.findFirst({
        where: {
          id: capsuleId,
          room_id: roomId,
          owner_participant_id: participant.id,
        },
      });
      if (!capsule) {
        throw Errors.FORBIDDEN('你不能捨棄此 Capsule');
      }

      if (capsule.status === 'discarded') {
        await tx.contextAuthorization.updateMany({
          where: { capsule_id: capsule.id, revoked_at: null },
          data: { revoked_at: now, revocation_reason_code: 'capsule_discarded' },
        });
        await this.cancelRequestsUsingCapsule(tx, roomId, capsule.id, now);
        return capsule;
      }
      if (
        !['draft', 'approved'].includes(capsule.status) ||
        capsule.revoked_at !== null ||
        !capsule.expires_at ||
        capsule.expires_at <= now
      ) {
        throw Errors.CONFLICT('Capsule 已失效，不能捨棄');
      }

      const discarded = await tx.contextCapsule.updateMany({
        where: {
          id: capsule.id,
          room_id: roomId,
          owner_participant_id: participant.id,
          content_hash: capsule.content_hash,
          policy_version: capsule.policy_version,
          status: { in: ['draft', 'approved'] },
          revoked_at: null,
          expires_at: { gt: now },
        },
        data: { status: 'discarded', revoked_at: now },
      });
      if (discarded.count !== 1) {
        throw Errors.CONFLICT('Capsule 狀態已變更，請重新載入');
      }

      await tx.contextAuthorization.updateMany({
        where: { capsule_id: capsule.id, revoked_at: null },
        data: { revoked_at: now, revocation_reason_code: 'capsule_discarded' },
      });
      await this.cancelRequestsUsingCapsule(tx, roomId, capsule.id, now);
      const updated = await tx.contextCapsule.findUniqueOrThrow({
        where: { id: capsule.id },
      });
      await writeContextUseAudit(tx, {
        roomId,
        actorParticipantId: participant.id,
        capsuleId: capsule.id,
        purpose: 'private_support',
        audience: 'private_owner',
        targetType: 'chat_room',
        targetId: roomId,
        decision: 'denied',
        reasonCode: 'capsule_discarded',
        sourceRefs: [],
        contentHashes: [],
      });
      return updated;
    });
  }

  async revokeAuthorization(
    roomId: string,
    authorizationId: string,
    actor: ChatActorContext,
    input: RevokeContextAuthorizationInput
  ) {
    if (input.reason_code !== 'user_revoked') {
      throw Errors.VALIDATION_ERROR('不支援的 authorization revocation reason');
    }
    const now = this.clock();
    return this.transaction(async tx => {
      const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
        roomId,
        actor,
        tx
      );
      const authorization = await tx.contextAuthorization.findFirst({
        where: {
          id: authorizationId,
          subject_participant_id: participant.id,
          capsule: { room_id: roomId },
        },
        include: { capsule: true },
      });
      if (!authorization) {
        throw Errors.FORBIDDEN('你不能撤回此 authorization');
      }
      if (authorization.revoked_at) {
        if (
          authorization.purpose === 'formal_analysis_evidence' &&
          authorization.audience === 'analysis_participants'
        ) {
          await this.cancelRequestsUsingCapsule(tx, roomId, authorization.capsule_id, now);
        }
        return tx.contextAuthorization.findUniqueOrThrow({
          where: { id: authorization.id },
        });
      }
      const revoked = await tx.contextAuthorization.updateMany({
        where: {
          id: authorization.id,
          subject_participant_id: participant.id,
          revoked_at: null,
        },
        data: {
          revoked_at: now,
          revocation_reason_code: input.reason_code,
        },
      });
      if (revoked.count !== 1) {
        throw Errors.CONFLICT('Authorization 狀態已變更');
      }
      if (
        authorization.purpose === 'formal_analysis_evidence' &&
        authorization.audience === 'analysis_participants'
      ) {
        await this.cancelRequestsUsingCapsule(tx, roomId, authorization.capsule_id, now);
      }
      const updated = await tx.contextAuthorization.findUniqueOrThrow({
        where: { id: authorization.id },
      });
      await writeContextUseAudit(tx, {
        roomId,
        actorParticipantId: participant.id,
        capsuleId: authorization.capsule_id,
        authorizationId: authorization.id,
        purpose: authorization.purpose,
        audience: authorization.audience,
        targetType: 'chat_room',
        targetId: authorization.target_id,
        decision: 'denied',
        reasonCode: 'context_authorization_revoked',
        sourceRefs: [
          {
            kind: 'context_capsule',
            id: authorization.capsule_id,
            version: authorization.capsule.version,
            content_hash: authorization.capsule_content_hash,
          },
        ],
        authorizationRefs: [
          {
            id: authorization.id,
            capsule_id: authorization.capsule_id,
            capsule_content_hash: authorization.capsule_content_hash,
          },
        ],
        contentHashes: [authorization.capsule_content_hash],
      });
      return updated;
    });
  }
}

export const contextCapsuleService = new ContextCapsuleService();
