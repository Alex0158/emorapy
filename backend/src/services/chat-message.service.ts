import {
  ChatChannelKind,
  ChatRoomStatus,
  ChatVisibilityScope,
  type ChatChannel,
  type ChatMessage,
  type ChatParticipant,
} from '@prisma/client';
import prisma from '../config/database';
import type { BackendLocale } from '../i18n';
import { isTransactionWriteConflict } from '../utils/chat-context-validation';
import { Errors } from '../utils/errors';
import {
  chatActorAccessService,
  type AccessibleChatRoom,
  type ChatActorContext,
} from './chat-actor-access.service';
import { chatAIOrchestrator } from './chat-ai-orchestrator.service';
import { chatChannelService } from './chat-channel.service';
import { chatEventsService } from './chat-events.service';
import { chatMetricsService } from './chat-metrics.service';
import { chatSafetyRouterService } from './chat-safety-router.service';
import { buildVisibleChatMessageWhere } from './chat-message-audience-policy';
import { privateAnalystOrchestrator } from './private-analyst-orchestrator.service';
import { safetyRoutingService } from './safety-routing.service';

export type ListChatMessagesInput = {
  cursor?: string;
  limit: number;
};

export type SendChatMessageInput = {
  content: string;
  visibilityScope: ChatVisibilityScope;
  channelId?: string;
  replyToMessageId?: string | null;
  locale?: BackendLocale;
};

type PersistedChatMessage = {
  message: ChatMessage & {
    sender_participant: ChatParticipant;
    channel: ChatChannel | null;
  };
  room: AccessibleChatRoom;
  participant: ChatParticipant;
  channel: ChatChannel;
  aiParticipant: ChatParticipant | null;
  safetySharedStatusChanged: boolean;
};

/**
 * Owns every human-message read/write path and the resulting AI-lane dispatch.
 * Room lifecycle and judgment handoff stay outside this boundary.
 */
export class ChatMessageService {
  private roomMessageTimestamps = new Map<string, number[]>();
  private readonly ROOM_RATE_WINDOW_MS = 30_000;
  private readonly ROOM_RATE_MAX = 6;
  private readonly ROOM_MIN_INTERVAL_MS = 5_000;

  private checkRoomRateLimit(roomId: string): void {
    const now = Date.now();
    const timestamps = (this.roomMessageTimestamps.get(roomId) ?? [])
      .filter(timestamp => now - timestamp <= this.ROOM_RATE_WINDOW_MS);
    const lastTimestamp = timestamps[timestamps.length - 1];
    if (
      (lastTimestamp !== undefined && now - lastTimestamp < this.ROOM_MIN_INTERVAL_MS)
      || timestamps.length >= this.ROOM_RATE_MAX
    ) {
      chatMetricsService.recordRateLimit().catch(() => undefined);
      throw Errors.RATE_LIMIT_EXCEEDED('訊息發送過於頻繁，請稍後再試');
    }
    timestamps.push(now);
    this.roomMessageTimestamps.set(roomId, timestamps);
  }

  async listMessages(
    roomId: string,
    actor: ChatActorContext,
    input: ListChatMessagesInput,
  ) {
    const resolvedActor = await chatActorAccessService.ensureActor(actor);
    const room = await chatActorAccessService.getAccessibleRoom(roomId, resolvedActor);
    const participant = chatActorAccessService.getCurrentParticipant(room, resolvedActor);
    const cursorDate = input.cursor ? new Date(input.cursor) : undefined;

    if (
      !participant
      || (participant.role_in_room !== 'roleA' && participant.role_in_room !== 'roleB')
    ) {
      throw Errors.FORBIDDEN('只有聊天室成員可查看訊息');
    }
    if (input.cursor && Number.isNaN(cursorDate?.getTime())) {
      throw Errors.VALIDATION_ERROR('cursor 必須為有效 ISO 時間');
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        room_id: room.id,
        ...(cursorDate ? { created_at: { lt: cursorDate } } : {}),
        ...buildVisibleChatMessageWhere(participant, room.history_visibility_mode),
      },
      orderBy: { created_at: 'desc' },
      take: input.limit,
      include: {
        sender_participant: true,
      },
    });

    const normalized = messages.reverse();
    return {
      messages: normalized,
      nextCursor: normalized.length > 0 ? normalized[0].created_at.toISOString() : null,
    };
  }

  async sendMessage(
    roomId: string,
    actor: ChatActorContext,
    input: SendChatMessageInput,
  ) {
    const resolvedActor = await chatActorAccessService.ensureActor(actor);
    if (input.visibilityScope === ChatVisibilityScope.summary_only) {
      throw Errors.VALIDATION_ERROR(
        '摘要分享功能正在升級；原始訊息未儲存或分享，請改用私人訊息',
        {
          reason_code: 'CHAT_SUMMARY_ONLY_UNAVAILABLE',
          safe_visibility_scope: ChatVisibilityScope.owner_only,
        },
      );
    }

    let persisted: PersistedChatMessage;
    try {
      persisted = await prisma.$transaction(async tx => {
        const context = await chatActorAccessService.resolveActiveHumanParticipant(
          roomId,
          resolvedActor,
          tx,
        );
        const { room, participant } = context;

        if (
          room.status !== ChatRoomStatus.solo_active
          && room.status !== ChatRoomStatus.invite_pending
          && room.status !== ChatRoomStatus.group_active
        ) {
          throw Errors.CASE_NOT_EDITABLE('當前狀態不可發送訊息');
        }

        const writeChannel = input.channelId
          ? await chatChannelService.resolveChannelForWrite(
              input.channelId,
              resolvedActor,
              tx,
            )
          : {
              room,
              participant,
              channel: await chatChannelService.getOrCreateWriteChannelForParticipant(
                room,
                participant.id,
                input.visibilityScope,
                tx,
              ),
              visibilityScope: input.visibilityScope,
            };
        if (
          writeChannel.room.id !== room.id
          || writeChannel.participant.id !== participant.id
        ) {
          throw Errors.FORBIDDEN('對話空間與聊天室身份不一致');
        }

        const effectiveVisibilityScope = writeChannel.channel.kind === ChatChannelKind.shared
          ? ChatVisibilityScope.all
          : ChatVisibilityScope.owner_only;
        let safetySharedStatusChanged = false;
        if (effectiveVisibilityScope === ChatVisibilityScope.all) {
          // Every shared sender takes both human rows in one deterministic order.
          // This gives either participant's private Safety activation a common
          // lock and avoids the roleA->roleB / roleB->roleA deadlock pattern.
          await chatActorAccessService.lockActiveHumanParticipants(tx, room.id);
          await chatActorAccessService.lockActiveParticipant(tx, room.id, participant.id);
          await chatActorAccessService.lockActiveRoleB(tx, room.id);
          await chatSafetyRouterService.assertSharedMessagingAllowed(room.id, tx);
        } else {
          await chatActorAccessService.lockActiveParticipant(tx, room.id, participant.id);
          const safetyRoute = safetyRoutingService.decideRoute({
            plaintiffStatement: input.content,
            defendantStatement: '',
          });
          // Linearize the private signal and action-only safety state with the
          // private write. A concurrent shared send can only observe the state
          // before this transaction or after the durable activation.
          const activation = await chatSafetyRouterService.activateForRouteWithClient({
            roomId: room.id,
            ownerParticipantId: participant.id,
            route: safetyRoute.route,
          }, tx);
          safetySharedStatusChanged = activation.sharedStatusChanged;
        }

        this.checkRoomRateLimit(room.id);

        let replyTarget: { id: string } | null = null;
        if (input.replyToMessageId) {
          replyTarget = await tx.chatMessage.findFirst({
            where: {
              id: input.replyToMessageId,
              room_id: room.id,
              ...(effectiveVisibilityScope === ChatVisibilityScope.all
                ? { visibility_scope: ChatVisibilityScope.all }
                : {}),
              ...buildVisibleChatMessageWhere(participant, room.history_visibility_mode),
            },
            select: { id: true },
          });
          if (!replyTarget) {
            throw Errors.NOT_FOUND('回覆的訊息不存在');
          }
        }

        const message = await tx.chatMessage.create({
          data: {
            room_id: room.id,
            channel_id: writeChannel.channel.id,
            sender_participant_id: participant.id,
            content: input.content.trim(),
            message_type: 'user_text',
            visibility_scope: effectiveVisibilityScope,
            ai_context_eligible: true,
            reply_to_message_id: replyTarget?.id ?? null,
          },
          include: {
            sender_participant: true,
            channel: true,
          },
        });
        const aiParticipant = room.participants.find(candidate => (
          candidate.role_in_room === 'aiMediator' && candidate.is_active
        )) ?? null;
        return {
          message,
          room,
          participant,
          channel: writeChannel.channel,
          aiParticipant,
          safetySharedStatusChanged,
        };
      }, { isolationLevel: 'ReadCommitted' });
    } catch (error) {
      if (isTransactionWriteConflict(error)) {
        throw Errors.CONFLICT('聊天室成員或訊息狀態已變更，請重試');
      }
      throw error;
    }

    const {
      message,
      room,
      participant,
      channel,
      aiParticipant,
      safetySharedStatusChanged,
    } = persisted;
    chatMetricsService.recordMessage().catch(() => undefined);
    if (channel.kind === ChatChannelKind.private) {
      if (safetySharedStatusChanged) {
        chatEventsService.publish({
          type: 'room_status',
          roomId: room.id,
          payload: { safetyStatusChanged: true },
          at: new Date().toISOString(),
        });
      }
      void privateAnalystOrchestrator.onUserMessage(
        {
          roomId: room.id,
          roomStatus: room.status,
          privateChannelId: channel.id,
          ownerParticipantId: participant.id,
          aiParticipant,
          locale: input.locale,
        },
        { id: message.id, content: message.content },
      );
    } else {
      void chatAIOrchestrator.onUserMessage(
        {
          roomId: room.id,
          roomStatus: room.status,
          aiParticipant,
          historyVisibilityMode: room.history_visibility_mode,
          sharedChannelId: channel.id,
          locale: input.locale,
        },
        message.sender_participant,
        {
          id: message.id,
          content: message.content,
          visibility_scope: message.visibility_scope,
        },
      );
    }

    return message;
  }

  async sendMessageToChannel(
    channelId: string,
    actor: ChatActorContext,
    input: Omit<SendChatMessageInput, 'channelId' | 'visibilityScope'>,
  ) {
    const channelContext = await chatChannelService.resolveChannelForWrite(channelId, actor);
    return this.sendMessage(channelContext.room.id, channelContext.actor, {
      ...input,
      channelId,
      visibilityScope: channelContext.visibilityScope,
    });
  }
}

export const chatMessageService = new ChatMessageService();
