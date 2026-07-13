import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ContextPurpose,
  ContextSourceKind,
  ContextUsageReceipt,
  ContextUsageReceiptCategory,
  ContextUsageReceiptScope,
  ContextUsageSourceTypeCounts,
  ContextUseDecision,
} from '@emorapy/contracts/chat';
import prisma from '../config/database';
import {
  ChatActorAccessService,
  chatActorAccessService,
  type ChatActorContext,
} from './chat-actor-access.service';

type ActorAccessRuntime = Pick<ChatActorAccessService, 'resolveActiveHumanParticipant'>;

type ReceiptRule = {
  category: ContextUsageReceiptCategory;
  purposes: readonly ContextPurpose[];
  decisions: readonly ContextUseDecision[];
  legacySourceKind?: ContextSourceKind;
};

const CAPSULE_AUTHORIZATION_PURPOSES: readonly ContextPurpose[] = [
  'private_support',
  'shared_mediation',
  'formal_analysis_evidence',
  'formal_analysis_delivery',
  'safety_routing',
];

const ACTOR_RECEIPT_RULES: Readonly<Record<string, ReceiptRule>> = {
  capsule_draft_created: {
    category: 'capsule_lifecycle',
    purposes: ['private_support'],
    decisions: ['allowed'],
  },
  capsule_revision_created: {
    category: 'capsule_lifecycle',
    purposes: ['private_support'],
    decisions: ['allowed'],
  },
  capsule_discarded: {
    category: 'capsule_lifecycle',
    purposes: ['private_support'],
    decisions: ['denied'],
  },
  context_authorization_granted: {
    category: 'authorization',
    purposes: CAPSULE_AUTHORIZATION_PURPOSES,
    decisions: ['allowed'],
  },
  context_authorization_revoked: {
    category: 'authorization',
    purposes: CAPSULE_AUTHORIZATION_PURPOSES,
    decisions: ['denied'],
  },
  analysis_request_created: {
    category: 'analysis_request',
    purposes: ['formal_analysis_evidence'],
    decisions: ['allowed'],
  },
  analysis_request_submitted: {
    category: 'analysis_request',
    purposes: ['formal_analysis_evidence'],
    decisions: ['allowed'],
  },
  analysis_participant_approved: {
    category: 'analysis_consent',
    purposes: ['formal_analysis_evidence'],
    decisions: ['allowed'],
  },
  analysis_participant_declined: {
    category: 'analysis_consent',
    purposes: ['formal_analysis_evidence'],
    decisions: ['denied'],
  },
  analysis_approval_revoked: {
    category: 'analysis_consent',
    purposes: ['formal_analysis_evidence'],
    decisions: ['denied'],
  },
  private_adaptation_authorization_granted: {
    category: 'adaptation_consent',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['allowed'],
  },
  private_adaptation_authorization_revoked: {
    category: 'adaptation_consent',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['denied'],
  },
  shared_adaptation_mode_accepted: {
    category: 'adaptation_consent',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['allowed'],
  },
  shared_adaptation_mode_declined: {
    category: 'adaptation_consent',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['denied'],
  },
  owner_private_support_bundle: {
    category: 'private_support_use',
    purposes: ['private_support'],
    decisions: ['allowed'],
    legacySourceKind: 'chat_message',
  },
  owner_strategy_compilation_requested: {
    category: 'adaptation_use',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['allowed'],
    legacySourceKind: 'chat_message',
  },
  owner_strategy_compilation_emitted: {
    category: 'adaptation_use',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['allowed'],
    legacySourceKind: 'chat_message',
  },
  owner_strategy_compilation_no_source: {
    category: 'adaptation_use',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['denied'],
    legacySourceKind: 'chat_message',
  },
  owner_strategy_compilation_schema_rejected: {
    category: 'adaptation_use',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['denied'],
    legacySourceKind: 'chat_message',
  },
  owner_strategy_compilation_provider_failed: {
    category: 'adaptation_use',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['denied'],
    legacySourceKind: 'chat_message',
  },
};

const ROOM_RECEIPT_RULES: Readonly<Record<string, ReceiptRule>> = {
  shared_adaptation_consent_incomplete: {
    category: 'adaptation_readiness',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['denied'],
  },
  private_adaptation_owner_opt_in_missing: {
    category: 'adaptation_readiness',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['denied'],
  },
  owner_strategy_controls_merged: {
    category: 'adaptation_use',
    purposes: ['shared_mediation_adaptation'],
    decisions: ['allowed'],
  },
  approved_capsule_exact_authorization: {
    category: 'shared_mediation_use',
    purposes: ['shared_mediation'],
    decisions: ['allowed'],
    legacySourceKind: 'context_capsule',
  },
};

const SOURCE_KINDS: readonly ContextSourceKind[] = [
  'chat_message',
  'context_capsule',
  'personal_memory',
  'joint_memory',
  'formal_evidence',
];

function emptySourceCounts(): ContextUsageSourceTypeCounts {
  return {
    chat_message: 0,
    context_capsule: 0,
    personal_memory: 0,
    joint_memory: 0,
    formal_evidence: 0,
  };
}

function parseSourceCounts(
  value: Prisma.JsonValue,
  legacySourceKind?: ContextSourceKind
): ContextUsageSourceTypeCounts | null {
  if (!Array.isArray(value)) return null;
  const counts = emptySourceCounts();
  for (const item of value) {
    if (typeof item === 'string') {
      if (!item || !legacySourceKind) return null;
      counts[legacySourceKind] += 1;
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (
      Object.keys(record).some(
        key => !['kind', 'id', 'version', 'content_hash'].includes(key)
      ) ||
      !SOURCE_KINDS.includes(record.kind as ContextSourceKind) ||
      typeof record.id !== 'string' ||
      record.id.length === 0
    ) {
      return null;
    }
    counts[record.kind as ContextSourceKind] += 1;
  }
  return counts;
}

function parseAuthorizationCount(value: Prisma.JsonValue): number | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item === 'string') {
      if (!item) return null;
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (
      Object.keys(record).some(
        key => !['id', 'capsule_id', 'capsule_content_hash'].includes(key)
      ) ||
      typeof record.id !== 'string' ||
      record.id.length === 0
    ) {
      return null;
    }
  }
  return value.length;
}

type AuditReadModel = {
  actor_participant_id: string | null;
  purpose: ContextPurpose;
  decision: ContextUseDecision;
  reason_code: string;
  source_refs: Prisma.JsonValue;
  authorization_refs: Prisma.JsonValue;
  policy_version: string;
  prompt_version: string | null;
  created_at: Date;
};

function toReceipt(
  audit: AuditReadModel,
  scope: ContextUsageReceiptScope
): ContextUsageReceipt | null {
  const rule = (scope === 'actor' ? ACTOR_RECEIPT_RULES : ROOM_RECEIPT_RULES)[
    audit.reason_code
  ];
  if (
    !rule ||
    !rule.purposes.includes(audit.purpose) ||
    !rule.decisions.includes(audit.decision) ||
    !audit.policy_version ||
    !(audit.created_at instanceof Date) ||
    Number.isNaN(audit.created_at.getTime())
  ) {
    return null;
  }
  const sourceTypeCounts = parseSourceCounts(audit.source_refs, rule.legacySourceKind);
  const authorizationCount = parseAuthorizationCount(audit.authorization_refs);
  if (!sourceTypeCounts || authorizationCount === null) return null;

  return {
    scope,
    purpose: audit.purpose,
    decision: audit.decision,
    category: rule.category,
    source_type_counts: sourceTypeCounts,
    authorization_count: authorizationCount,
    policy_version: audit.policy_version,
    prompt_version: audit.prompt_version,
    created_at: audit.created_at.toISOString(),
  };
}

export class ChatContextUsageReceiptService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly actorAccess: ActorAccessRuntime = chatActorAccessService
  ) {}

  async listOwnerReceipts(
    roomId: string,
    actor: ChatActorContext
  ): Promise<ContextUsageReceipt[]> {
    return this.db.$transaction(
      async tx => {
        const { participant } = await this.actorAccess.resolveActiveHumanParticipant(
          roomId,
          actor,
          tx
        );
        const audits = await tx.contextUseAudit.findMany({
          where: {
            room_id: roomId,
            OR: [
              { actor_participant_id: participant.id },
              { actor_participant_id: null },
            ],
          },
          select: {
            actor_participant_id: true,
            purpose: true,
            decision: true,
            reason_code: true,
            source_refs: true,
            authorization_refs: true,
            policy_version: true,
            prompt_version: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: 100,
        });

        return audits.flatMap(audit => {
          const scope = audit.actor_participant_id === participant.id
            ? 'actor'
            : audit.actor_participant_id === null
              ? 'room_aggregate'
              : null;
          if (!scope) return [];
          const receipt = toReceipt(audit as AuditReadModel, scope);
          return receipt ? [receipt] : [];
        });
      },
      { isolationLevel: 'Serializable' }
    );
  }
}

export const chatContextUsageReceiptService = new ChatContextUsageReceiptService();
