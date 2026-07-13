import {
  ChatChannelKind,
  ChatRoomStatus,
  ChatRoleInRoom,
  ChatVisibilityScope,
  Prisma,
} from '@prisma/client';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import {
  chatActorAccessService,
  type AccessibleChatRoom,
  type ChatActorContext,
} from './chat-actor-access.service';
import {
  buildSharedHistoryCutoffWhere,
  isWithinSharedHistoryCutoff,
} from './chat-message-audience-policy';

type ListChannelMessagesInput = {
  cursor?: string;
  limit: number;
};

type ActorChannelContext = Awaited<
  ReturnType<typeof chatActorAccessService.resolveActiveHumanParticipant>
>;
type ChatChannelDb = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'chatChannel' | 'chatMessage' | 'chatRoom'
>;

const HUMAN_ROLES = [ChatRoleInRoom.roleA, ChatRoleInRoom.roleB] as const;

export class ChatChannelService {
  private async ensureChannels(
    room: AccessibleChatRoom,
    db: ChatChannelDb = prisma,
  ) {
    const humanParticipants = room.participants.filter((participant) => (
      HUMAN_ROLES.includes(participant.role_in_room as (typeof HUMAN_ROLES)[number])
    ));

    await db.chatChannel.createMany({
      data: [
        { room_id: room.id, kind: ChatChannelKind.shared },
        ...humanParticipants.map((participant) => ({
          room_id: room.id,
          kind: ChatChannelKind.private,
          owner_participant_id: participant.id,
        })),
      ],
      skipDuplicates: true,
    });

    return db.chatChannel.findMany({
      where: { room_id: room.id },
      orderBy: [{ kind: 'asc' }, { created_at: 'asc' }],
    });
  }

  private assertAudience(
    channel: { kind: ChatChannelKind; owner_participant_id: string | null },
    participantId: string,
  ) {
    if (
      channel.kind === ChatChannelKind.private
      && channel.owner_participant_id !== participantId
    ) {
      throw Errors.FORBIDDEN('你沒有該私人對話空間權限');
    }
  }

  private assertSharedWriteReady(room: AccessibleChatRoom) {
    if (room.status !== ChatRoomStatus.group_active) {
      throw Errors.CASE_NOT_EDITABLE('對方加入後才可發送共同訊息');
    }
    const hasActiveRoleB = room.participants.some((participant) => (
      participant.role_in_room === ChatRoleInRoom.roleB
      && participant.participant_type === 'user'
      && participant.is_active
      && participant.left_at === null
    ));
    if (!hasActiveRoleB) {
      throw Errors.CASE_NOT_EDITABLE('對方加入後才可發送共同訊息');
    }
  }

  async listActorChannels(roomId: string, actor: ChatActorContext) {
    const context = await chatActorAccessService.resolveActiveHumanParticipant(roomId, actor);
    const channels = await this.ensureChannels(context.room);
    return channels.filter((channel) => (
      channel.kind === ChatChannelKind.shared
      || channel.owner_participant_id === context.participant.id
    ));
  }

  async resolveAccessibleChannel(
    channelId: string,
    actor: ChatActorContext,
    db: ChatChannelDb = prisma,
  ) {
    const channelRef = await db.chatChannel.findUnique({
      where: { id: channelId },
      select: { room_id: true },
    });
    if (!channelRef) throw Errors.NOT_FOUND('對話空間不存在');

    const context = await chatActorAccessService.resolveActiveHumanParticipant(
      channelRef.room_id,
      actor,
      db,
    );
    const channel = await db.chatChannel.findFirst({
      where: { id: channelId, room_id: context.room.id },
    });
    if (!channel) throw Errors.NOT_FOUND('對話空間不存在');
    this.assertAudience(channel, context.participant.id);
    return { ...context, channel };
  }

  async resolveChannelForWrite(
    channelId: string,
    actor: ChatActorContext,
    db: ChatChannelDb = prisma,
  ) {
    const context = await this.resolveAccessibleChannel(channelId, actor, db);
    if (context.channel.kind === ChatChannelKind.shared) {
      this.assertSharedWriteReady(context.room);
      await chatActorAccessService.lockActiveRoleB(db, context.room.id);
    }
    return {
      ...context,
      visibilityScope: context.channel.kind === ChatChannelKind.shared
        ? ChatVisibilityScope.all
        : ChatVisibilityScope.owner_only,
    };
  }

  async resolveLegacyWriteChannel(
    roomId: string,
    actor: ChatActorContext,
    visibilityScope: ChatVisibilityScope,
    db: ChatChannelDb = prisma,
  ) {
    const context = await chatActorAccessService.resolveActiveHumanParticipant(roomId, actor, db);
    const channel = await this.getOrCreateWriteChannelForParticipant(
      context.room,
      context.participant.id,
      visibilityScope,
      db,
    );
    return { ...context, channel };
  }

  async getOrCreateWriteChannelForParticipant(
    room: AccessibleChatRoom,
    participantId: string,
    visibilityScope: ChatVisibilityScope,
    db: ChatChannelDb = prisma,
  ) {
    const expectedKind = visibilityScope === ChatVisibilityScope.all
      ? ChatChannelKind.shared
      : ChatChannelKind.private;
    if (expectedKind === ChatChannelKind.shared) {
      this.assertSharedWriteReady(room);
      await chatActorAccessService.lockActiveRoleB(db, room.id);
    }
    const channels = await this.ensureChannels(room, db);
    const channel = channels.find((candidate) => (
      candidate.kind === expectedKind
      && (
        expectedKind === ChatChannelKind.shared
        || candidate.owner_participant_id === participantId
      )
    ));
    if (!channel) throw Errors.INTERNAL_ERROR('無法建立對話空間');
    return channel;
  }

  private buildLegacyChannelWhere(
    context: ActorChannelContext,
    channel: { kind: ChatChannelKind },
  ): Prisma.ChatMessageWhereInput {
    if (channel.kind === ChatChannelKind.private) {
      return {
        channel_id: null,
        sender_participant_id: context.participant.id,
        visibility_scope: {
          in: [ChatVisibilityScope.owner_only, ChatVisibilityScope.summary_only],
        },
      };
    }

    const sharedLegacy: Prisma.ChatMessageWhereInput = {
      channel_id: null,
      visibility_scope: ChatVisibilityScope.all,
      ...buildSharedHistoryCutoffWhere(
        context.participant,
        context.room.history_visibility_mode,
      ),
    };
    return sharedLegacy;
  }

  async listMessages(
    channelId: string,
    actor: ChatActorContext,
    input: ListChannelMessagesInput,
  ) {
    const context = await this.resolveAccessibleChannel(channelId, actor);
    const cursorDate = input.cursor ? new Date(input.cursor) : undefined;
    if (input.cursor && Number.isNaN(cursorDate?.getTime())) {
      throw Errors.VALIDATION_ERROR('cursor 必須為有效 ISO 時間');
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        room_id: context.room.id,
        ...(cursorDate ? { created_at: { lt: cursorDate } } : {}),
        OR: [
          {
            channel_id: context.channel.id,
            ...(context.channel.kind === ChatChannelKind.shared
              ? buildSharedHistoryCutoffWhere(
                  context.participant,
                  context.room.history_visibility_mode,
                )
              : {}),
          },
          this.buildLegacyChannelWhere(context, context.channel),
        ],
      },
      include: { sender_participant: true, channel: true },
      orderBy: { created_at: 'desc' },
      take: input.limit,
    });

    const visibleMessages = context.channel.kind === ChatChannelKind.shared
      ? messages.filter(message => isWithinSharedHistoryCutoff(
          message.created_at,
          context.participant,
          context.room.history_visibility_mode,
        ))
      : messages;
    const ordered = visibleMessages.reverse();
    return {
      messages: ordered,
      nextCursor: visibleMessages.length === input.limit
        ? visibleMessages[0]?.created_at.toISOString() ?? null
        : null,
    };
  }

  async getSharedChannel(roomId: string) {
    const channel = await prisma.chatChannel.findFirst({
      where: { room_id: roomId, kind: ChatChannelKind.shared },
    });
    if (channel) return channel;

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });
    if (!room) throw Errors.NOT_FOUND('聊天室不存在');
    const channels = await this.ensureChannels(room);
    const shared = channels.find((candidate) => candidate.kind === ChatChannelKind.shared);
    if (!shared) throw Errors.INTERNAL_ERROR('無法建立共同對話空間');
    return shared;
  }
}

export const chatChannelService = new ChatChannelService();
