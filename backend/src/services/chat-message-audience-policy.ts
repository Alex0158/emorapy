import {
  ChatHistoryVisibilityMode,
  ChatRoleInRoom,
  Prisma,
} from '@prisma/client';
import type { ChatMessageType, ChatVisibilityScope } from '@prisma/client';

export type HumanParticipantAudience = {
  id: string;
  role_in_room: ChatRoleInRoom;
  joined_at?: Date | null;
};

type SharedContextInput = {
  roomId: string;
  historyVisibilityMode: ChatHistoryVisibilityMode;
  roleBJoinedAt?: Date | null;
};

type SharedContextCandidate = {
  message_type: ChatMessageType | string;
  visibility_scope: ChatVisibilityScope | string;
  ai_context_eligible: boolean;
  created_at: Date;
  sender_participant: { is_active: boolean } | null;
};

const LEGACY_PRIVATE_SCOPES = [
  'owner_only',
  'summary_only',
] as const;

/**
 * Participant-aware cutoff for every shared-message read. A roleB without a
 * durable join timestamp fails closed; only share_full_history removes the
 * cutoff. The predicate is intentionally channel-agnostic so callers can apply
 * it to both channelized and legacy shared rows.
 */
export function buildSharedHistoryCutoffWhere(
  participant: HumanParticipantAudience,
  historyVisibilityMode: ChatHistoryVisibilityMode,
): Prisma.ChatMessageWhereInput {
  if (
    participant.role_in_room !== ChatRoleInRoom.roleB
    || historyVisibilityMode === ChatHistoryVisibilityMode.share_full_history
  ) {
    return {};
  }
  if (!participant.joined_at) return { id: { in: [] } };
  return { created_at: { gte: participant.joined_at } };
}

export function isWithinSharedHistoryCutoff(
  createdAt: Date,
  participant: HumanParticipantAudience,
  historyVisibilityMode: ChatHistoryVisibilityMode,
): boolean {
  if (
    participant.role_in_room !== ChatRoleInRoom.roleB
    || historyVisibilityMode === ChatHistoryVisibilityMode.share_full_history
  ) {
    return true;
  }
  return Boolean(participant.joined_at && createdAt >= participant.joined_at);
}

/**
 * Legacy visibility projection used until channel-backed audiences land.
 * `owner_only` and the unsafe legacy `summary_only` are both private to the
 * sender; only `all` participates in room history sharing rules.
 */
export function buildVisibleChatMessageWhere(
  participant: HumanParticipantAudience,
  historyVisibilityMode: ChatHistoryVisibilityMode,
): Prisma.ChatMessageWhereInput {
  const sharedMessage: Prisma.ChatMessageWhereInput = {
    visibility_scope: 'all',
    ...buildSharedHistoryCutoffWhere(participant, historyVisibilityMode),
    OR: [
      { channel_id: null },
      { channel: { is: { kind: 'shared' } } },
    ],
  };

  return {
    OR: [
      sharedMessage,
      {
        sender_participant_id: participant.id,
        visibility_scope: { in: [...LEGACY_PRIVATE_SCOPES] },
        channel_id: null,
      },
      {
        channel: {
          is: {
            kind: 'private',
            owner_participant_id: participant.id,
          },
        },
      },
    ],
  };
}

/**
 * Builds the only context query allowed for room-wide AI output and formal
 * analysis: active-sender messages explicitly shared with the room.
 */
export function buildSharedContextMessageWhere(
  input: SharedContextInput,
): Prisma.ChatMessageWhereInput {
  const where: Prisma.ChatMessageWhereInput = {
    room_id: input.roomId,
    message_type: 'user_text',
    visibility_scope: 'all',
    ai_context_eligible: true,
    OR: [
      { channel_id: null },
      { channel: { is: { kind: 'shared' } } },
    ],
    sender_participant: {
      is: { is_active: true },
    },
  };

  if (
    input.roleBJoinedAt
    && input.historyVisibilityMode !== ChatHistoryVisibilityMode.share_full_history
  ) {
    where.created_at = { gte: input.roleBJoinedAt };
  }

  return where;
}

/** Defense in depth for callers that receive an unexpectedly broad repository result. */
export function filterSharedContextMessages<T extends SharedContextCandidate>(
  messages: T[],
  input: SharedContextInput,
): T[] {
  return messages.filter((message) => {
    if (
      message.visibility_scope !== 'all'
      || message.message_type !== 'user_text'
      || message.ai_context_eligible !== true
      || message.sender_participant?.is_active !== true
    ) {
      return false;
    }

    if (
      input.roleBJoinedAt
      && input.historyVisibilityMode !== ChatHistoryVisibilityMode.share_full_history
    ) {
      return message.created_at >= input.roleBJoinedAt;
    }

    return true;
  });
}

export function isRoomWideChatMessage(visibilityScope: ChatVisibilityScope | string): boolean {
  return visibilityScope === 'all';
}
