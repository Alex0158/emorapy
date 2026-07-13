import {
  ChatHistoryVisibilityMode,
  ChatChannelKind,
  ChatInviteStatus,
  ChatRoomStatus,
  ChatVisibilityScope,
  Prisma,
} from '@prisma/client';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import { generateInviteCode } from '../utils/session';
import logger from '../config/logger';
import { chatMetricsService } from './chat-metrics.service';
import { normalizeJudgmentWithSafetyState } from './judgment-normalization.service';
import {
  chatActorAccessService,
  type ChatActorContext,
} from './chat-actor-access.service';
import {
  ChatMessageService,
  chatMessageService,
  type ListChatMessagesInput,
  type SendChatMessageInput,
} from './chat-message.service';
import {
  ChatJudgmentOrchestrator,
  chatJudgmentOrchestrator,
  type RequestChatJudgmentOptions,
  type RequestChatJudgmentResult,
} from './chat-judgment-orchestrator.service';
import { chatAnalysisRequestService } from './chat-analysis-request.service';
import { chatStreamEntitlementService } from './chat-stream-entitlement.service';

type ActorContext = ChatActorContext;

type CreateRoomInput = {
  historyVisibilityMode?: ChatHistoryVisibilityMode;
};

type CreateInviteInput = {
  historyVisibilityMode?: ChatHistoryVisibilityMode;
  expiresInHours?: number;
};

export class ChatService {
  private readonly INVITE_COOLDOWN_MS = 60_000;
  private readonly INVITE_DECLINED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly messageService: ChatMessageService = chatMessageService,
    private readonly judgmentOrchestrator: ChatJudgmentOrchestrator = chatJudgmentOrchestrator,
  ) {}

  private async ensureActor(actor: ActorContext): Promise<ActorContext> {
    return chatActorAccessService.ensureActor(actor);
  }

  private async getAccessibleRoom(roomId: string, actor: ActorContext) {
    return chatActorAccessService.getAccessibleRoom(roomId, actor);
  }

  private getCurrentParticipant(
    room: Awaited<ReturnType<ChatService['getAccessibleRoom']>>,
    actor: ActorContext
  ) {
    return chatActorAccessService.getCurrentParticipant(room, actor);
  }

  async createRoom(actor: ActorContext, input: CreateRoomInput) {
    const resolvedActor = await this.ensureActor(actor);
    const visibilityMode = input.historyVisibilityMode ?? ChatHistoryVisibilityMode.share_from_join_time;

    return prisma.$transaction(async (tx) => {
      const room = await tx.chatRoom.create({
        data: {
          owner_user_id: resolvedActor.userId ?? null,
          session_id: resolvedActor.sessionId ?? null,
          status: ChatRoomStatus.solo_active,
          history_visibility_mode: visibilityMode,
        },
      });

      const roleAParticipant = await tx.chatParticipant.create({
        data: {
          room_id: room.id,
          participant_type: 'user',
          user_id: resolvedActor.userId ?? null,
          role_in_room: 'roleA',
        },
      });

      await tx.chatParticipant.create({
        data: {
          room_id: room.id,
          participant_type: 'ai',
          role_in_room: 'aiMediator',
        },
      });

      await tx.chatChannel.createMany({
        data: [
          { room_id: room.id, kind: ChatChannelKind.shared },
          {
            room_id: room.id,
            kind: ChatChannelKind.private,
            owner_participant_id: roleAParticipant.id,
          },
        ],
        skipDuplicates: true,
      });

      return tx.chatRoom.findUnique({
        where: { id: room.id },
        include: {
          participants: true,
        },
      });
    });
  }

  async getRoom(roomId: string, actor: ActorContext) {
    const resolvedActor = await this.ensureActor(actor);
    return this.getAccessibleRoom(roomId, resolvedActor);
  }

  async createInvite(roomId: string, actor: ActorContext, input: CreateInviteInput) {
    const resolvedActor = await this.ensureActor(actor);
    const room = await this.getAccessibleRoom(roomId, resolvedActor);
    const currentParticipant = this.getCurrentParticipant(room, resolvedActor);

    if (!currentParticipant || currentParticipant.role_in_room !== 'roleA') {
      throw Errors.FORBIDDEN('只有發起方可發送邀請');
    }

    if (
      room.status === ChatRoomStatus.judgment_requested ||
      room.status === ChatRoomStatus.judgment_completed ||
      room.status === ChatRoomStatus.judgment_failed ||
      room.status === ChatRoomStatus.archived
    ) {
      throw Errors.CASE_NOT_EDITABLE('當前狀態不可邀請新成員');
    }
    const activeRoleB = room.participants.find((p) => p.role_in_room === 'roleB' && p.is_active);
    if (activeRoleB) {
      throw Errors.CONFLICT('聊天室已有 B 方成員，無需重複邀請');
    }

    const recentInvite = await prisma.chatInvite.findFirst({
      where: {
        room_id: room.id,
        created_at: { gt: new Date(Date.now() - this.INVITE_COOLDOWN_MS) },
      },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    if (recentInvite) {
      chatMetricsService.recordRateLimit().catch(() => undefined);
      throw Errors.RATE_LIMIT_EXCEEDED('邀請發送過於頻繁，請稍後再試');
    }

    const recentlyDeclinedInvite = await prisma.chatInvite.findFirst({
      where: {
        room_id: room.id,
        status: ChatInviteStatus.declined,
        responded_at: { gt: new Date(Date.now() - this.INVITE_DECLINED_COOLDOWN_MS) },
      },
      orderBy: { responded_at: 'desc' },
      select: { id: true, responded_at: true },
    });
    if (recentlyDeclinedInvite) {
      chatMetricsService.recordRateLimit().catch(() => undefined);
      throw Errors.RATE_LIMIT_EXCEEDED('對方剛婉拒邀請，請先留一些時間再重試');
    }

    const expiresInHours = Math.max(1, Math.min(input.expiresInHours ?? 24, 168));
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const visibilityMode = input.historyVisibilityMode ?? room.history_visibility_mode;

    const maxCodeRetry = 5;
    for (let attempt = 1; attempt <= maxCodeRetry; attempt++) {
      const inviteCode = generateInviteCode();
      try {
        return await prisma.$transaction(async (tx) => {
          const activeRoleBInTx = await tx.chatParticipant.findFirst({
            where: {
              room_id: room.id,
              role_in_room: 'roleB',
              is_active: true,
            },
          });
          if (activeRoleBInTx) {
            throw Errors.CONFLICT('聊天室已有 B 方成員，無需重複邀請');
          }

          await tx.chatInvite.updateMany({
            where: {
              room_id: room.id,
              status: ChatInviteStatus.pending,
            },
            data: {
              status: ChatInviteStatus.revoked,
              responded_at: new Date(),
            },
          });

          const roomTransition = await tx.chatRoom.updateMany({
            where: {
              id: room.id,
              status: {
                in: [ChatRoomStatus.solo_active, ChatRoomStatus.invite_pending, ChatRoomStatus.group_active],
              },
            },
            data: {
              status: ChatRoomStatus.invite_pending,
              history_visibility_mode: visibilityMode,
            },
          });
          if (roomTransition.count === 0) {
            throw Errors.CASE_NOT_EDITABLE('聊天室狀態已變更，請重試邀請');
          }

          return tx.chatInvite.create({
            data: {
              room_id: room.id,
              inviter_participant_id: currentParticipant.id,
              invite_code: inviteCode,
              status: ChatInviteStatus.pending,
              expires_at: expiresAt,
            },
          });
        });
      } catch (error) {
        const known = error as Prisma.PrismaClientKnownRequestError | undefined;
        if (known?.code === 'P2002' && attempt < maxCodeRetry) {
          logger.warn('Chat invite code collision, retrying', { roomId: room.id, attempt });
          continue;
        }
        throw error;
      }
    }

    throw Errors.INTERNAL_ERROR('無法生成唯一邀請碼，請稍後重試');
  }

  async acceptInvite(inviteCode: string, actor: ActorContext) {
    const resolvedActor = await this.ensureActor(actor);
    if (!resolvedActor.userId) {
      throw Errors.UNAUTHORIZED('接受邀請需要登入帳號');
    }

    const invite = await prisma.chatInvite.findFirst({
      where: { invite_code: inviteCode },
      include: {
        room: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!invite) {
      throw Errors.INVALID_CODE('邀請碼不存在');
    }
    if (invite.status !== ChatInviteStatus.pending) {
      throw Errors.INVALID_CODE('邀請碼不可用');
    }
    if (invite.expires_at && invite.expires_at < new Date()) {
      throw Errors.CODE_EXPIRED('邀請碼已過期');
    }
    if (invite.room.status !== ChatRoomStatus.invite_pending) {
      throw Errors.CASE_NOT_EDITABLE('聊天室當前狀態不允許接受邀請');
    }
    if (invite.invited_user_id && invite.invited_user_id !== resolvedActor.userId) {
      throw Errors.FORBIDDEN('此邀請僅限指定用戶接受');
    }
    if (invite.room.owner_user_id && invite.room.owner_user_id === resolvedActor.userId) {
      throw Errors.VALIDATION_ERROR('不能加入自己發起的聊天室');
    }

    try {
      const acceptedRoom = await prisma.$transaction(async (tx) => {
        const { count } = await tx.chatInvite.updateMany({
          where: {
            id: invite.id,
            status: ChatInviteStatus.pending,
            OR: [
              { invited_user_id: null },
              { invited_user_id: resolvedActor.userId },
            ],
          },
          data: {
            status: ChatInviteStatus.accepted,
            invited_user_id: resolvedActor.userId!,
            responded_at: new Date(),
          },
        });
        if (count === 0) {
          throw Errors.INVALID_CODE('邀請碼已失效或已被使用');
        }

        // 不使用 invite include 的舊快照；交易內重新查詢，避免併發下重複建立 roleB。
        const activeRoleB = await tx.chatParticipant.findFirst({
          where: {
            room_id: invite.room_id,
            role_in_room: 'roleB',
            is_active: true,
          },
        });
        if (activeRoleB && activeRoleB.user_id && activeRoleB.user_id !== resolvedActor.userId) {
          throw Errors.CONFLICT('聊天室已有 B 方成員，無法重複加入');
        }

        const existingRoleB = activeRoleB ?? await tx.chatParticipant.findFirst({
          where: {
            room_id: invite.room_id,
            role_in_room: 'roleB',
            user_id: resolvedActor.userId,
          },
          orderBy: { joined_at: 'desc' },
        });

        const roleBParticipant = existingRoleB
          ? await tx.chatParticipant.update({
            where: { id: existingRoleB.id },
            data: {
              participant_type: 'user',
              user_id: resolvedActor.userId,
              is_active: true,
              left_at: null,
              ...(existingRoleB.is_active ? {} : { joined_at: new Date() }),
            },
          })
          : await tx.chatParticipant.create({
            data: {
              room_id: invite.room_id,
              participant_type: 'user',
              user_id: resolvedActor.userId,
              role_in_room: 'roleB',
            },
          });

        await tx.chatChannel.createMany({
          data: [
            { room_id: invite.room_id, kind: ChatChannelKind.shared },
            {
              room_id: invite.room_id,
              kind: ChatChannelKind.private,
              owner_participant_id: roleBParticipant.id,
            },
          ],
          skipDuplicates: true,
        });

        await tx.chatInvite.updateMany({
          where: {
            room_id: invite.room_id,
            id: { not: invite.id },
            status: ChatInviteStatus.pending,
          },
          data: {
            status: ChatInviteStatus.revoked,
            responded_at: new Date(),
          },
        });

        const roomTransition = await tx.chatRoom.updateMany({
          where: {
            id: invite.room_id,
            status: ChatRoomStatus.invite_pending,
          },
          data: { status: ChatRoomStatus.group_active },
        });
        if (roomTransition.count === 0) {
          throw Errors.CASE_NOT_EDITABLE('聊天室當前狀態不允許接受邀請');
        }
        const room = await tx.chatRoom.findUnique({
          where: { id: invite.room_id },
          include: { participants: true },
        });
        if (!room) {
          throw Errors.NOT_FOUND('聊天室不存在');
        }

        return room;
      });
      const acceptedParticipant = acceptedRoom.participants.find(candidate => (
        candidate.role_in_room === 'roleB'
        && candidate.user_id === resolvedActor.userId
        && candidate.is_active
      ));
      if (acceptedParticipant) {
        chatStreamEntitlementService.activateParticipant(acceptedParticipant.id);
      }
      return acceptedRoom;
    } catch (error) {
      const known = error as Prisma.PrismaClientKnownRequestError | undefined;
      if (known?.code === 'P2002') {
        throw Errors.CONFLICT('聊天室已有 B 方成員，請刷新後重試');
      }
      throw error;
    }
  }

  async declineInvite(inviteCode: string, actor: ActorContext) {
    const resolvedActor = await this.ensureActor(actor);

    const invite = await prisma.chatInvite.findFirst({
      where: { invite_code: inviteCode },
      include: {
        room: true,
      },
    });
    if (!invite) {
      throw Errors.INVALID_CODE('邀請碼不存在');
    }
    if (invite.status !== ChatInviteStatus.pending) {
      throw Errors.INVALID_CODE('邀請碼不可用');
    }
    if (invite.expires_at && invite.expires_at < new Date()) {
      throw Errors.CODE_EXPIRED('邀請碼已過期');
    }
    if (invite.room.status !== ChatRoomStatus.invite_pending) {
      throw Errors.CASE_NOT_EDITABLE('聊天室當前狀態不允許拒絕邀請');
    }
    if (invite.invited_user_id) {
      if (!resolvedActor.userId) {
        throw Errors.UNAUTHORIZED('處理指定邀請需要登入帳號');
      }
      if (invite.invited_user_id !== resolvedActor.userId) {
        throw Errors.FORBIDDEN('此邀請僅限指定用戶處理');
      }
    } else {
      const canRevokePublicInvite =
        (invite.room.owner_user_id && invite.room.owner_user_id === resolvedActor.userId) ||
        (!invite.room.owner_user_id && invite.room.session_id && invite.room.session_id === resolvedActor.sessionId);
      if (!canRevokePublicInvite) {
        // 未指定對象的公開邀請，禁止第三方透過邀請碼主動拒絕，避免惡意撤銷。
        throw Errors.FORBIDDEN('公開邀請僅限房主撤回');
      }
    }

    return prisma.$transaction(async (tx) => {
      const inviteStatus = invite.invited_user_id ? ChatInviteStatus.declined : ChatInviteStatus.revoked;
      const { count } = await tx.chatInvite.updateMany({
        where: {
          id: invite.id,
          status: ChatInviteStatus.pending,
          OR: [
            { invited_user_id: null },
            { invited_user_id: resolvedActor.userId },
          ],
        },
        data: {
          status: inviteStatus,
          invited_user_id: invite.invited_user_id ? resolvedActor.userId : null,
          responded_at: new Date(),
        },
      });
      if (count === 0) {
        throw Errors.INVALID_CODE('邀請碼已失效或已被使用');
      }

      const pendingCount = await tx.chatInvite.count({
        where: {
          room_id: invite.room_id,
          status: ChatInviteStatus.pending,
          expires_at: {
            gt: new Date(),
          },
        },
      });

      if (pendingCount === 0 && invite.room.status === ChatRoomStatus.invite_pending) {
        await tx.chatRoom.updateMany({
          where: {
            id: invite.room_id,
            status: ChatRoomStatus.invite_pending,
          },
          data: { status: ChatRoomStatus.solo_active },
        });
      }

      return tx.chatInvite.findUnique({
        where: { id: invite.id },
      });
    });
  }

  async listMessages(
    roomId: string,
    actor: ActorContext,
    input: ListChatMessagesInput,
  ) {
    return this.messageService.listMessages(roomId, actor, input);
  }

  async sendMessage(
    roomId: string,
    actor: ActorContext,
    input: SendChatMessageInput,
  ) {
    return this.messageService.sendMessage(roomId, actor, input);
  }

  async sendMessageToChannel(
    channelId: string,
    actor: ActorContext,
    input: Omit<SendChatMessageInput, 'channelId' | 'visibilityScope'>,
  ) {
    return this.messageService.sendMessageToChannel(channelId, actor, input);
  }

  async requestJudgment(
    roomId: string,
    actor: ActorContext,
    options?: RequestChatJudgmentOptions,
  ): Promise<RequestChatJudgmentResult> {
    return this.judgmentOrchestrator.requestJudgment(roomId, actor, options);
  }
  async getJudgmentStatus(roomId: string, actor: ActorContext) {
    const resolvedActor = await this.ensureActor(actor);
    await this.getAccessibleRoom(roomId, resolvedActor);

    const latest = await prisma.chatToCaseLink.findFirst({
      where: { room_id: roomId },
      orderBy: { created_at: 'desc' },
      include: {
        case: {
          select: {
            id: true,
            status: true,
            mode: true,
            submitted_at: true,
            completed_at: true,
          },
        },
        judgment: {
          select: {
            id: true,
            created_at: true,
            plaintiff_ratio: true,
            defendant_ratio: true,
          },
        },
      },
    });

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { status: true },
    });

    const normalizedLatest = latest && latest.judgment
      ? {
        ...latest,
        judgment: await normalizeJudgmentWithSafetyState(latest.judgment, { caseId: latest.case.id }),
      }
      : latest;

    return {
      roomStatus: room?.status,
      latestLink: normalizedLatest,
    };
  }

  async leaveRoom(roomId: string, actor: ActorContext) {
    const resolvedActor = await this.ensureActor(actor);
    if (!resolvedActor.userId) {
      throw Errors.UNAUTHORIZED('需登入才能離開聊天室');
    }
    const room = await this.getAccessibleRoom(roomId, resolvedActor);
    const participant = room.participants.find(
      (p) => p.role_in_room === 'roleB' && p.user_id === resolvedActor.userId && p.is_active
    );
    if (!participant) {
      throw Errors.FORBIDDEN('只有 B 方成員可離開聊天室');
    }
    const leftAt = new Date();
    const updatedRoom = await prisma.$transaction(async tx => {
      const departed = await tx.chatParticipant.updateMany({
        where: { id: participant.id, room_id: room.id, is_active: true },
        data: { is_active: false, left_at: leftAt },
      });
      if (departed.count !== 1) throw Errors.CONFLICT('聊天室成員狀態已變更');
      await chatAnalysisRequestService.cancelActiveForParticipantDeparture(
        tx,
        room.id,
        participant.id,
        leftAt,
      );
      if (
        room.status === ChatRoomStatus.group_active ||
        room.status === ChatRoomStatus.invite_pending ||
        room.status === ChatRoomStatus.solo_active
      ) {
        await tx.chatRoom.updateMany({
          where: { id: room.id, status: room.status },
          data: { status: ChatRoomStatus.solo_active },
        });
      }
      return tx.chatRoom.findUnique({
        where: { id: room.id },
        include: { participants: true },
      });
    });
    chatStreamEntitlementService.revokeParticipant(participant.id);
    if (!updatedRoom) throw Errors.NOT_FOUND('聊天室不存在');
    return updatedRoom;
  }

  async kickParticipantB(roomId: string, actor: ActorContext) {
    const resolvedActor = await this.ensureActor(actor);
    const room = await this.getAccessibleRoom(roomId, resolvedActor);
    const actorParticipant = this.getCurrentParticipant(room, resolvedActor);
    if (!actorParticipant || actorParticipant.role_in_room !== 'roleA') {
      throw Errors.FORBIDDEN('只有發起方可以移除 B 方');
    }
    const participantB = room.participants.find((p) => p.role_in_room === 'roleB' && p.is_active);
    if (!participantB) {
      throw Errors.NOT_FOUND('聊天室目前沒有 B 方可移除');
    }
    const leftAt = new Date();
    const updatedRoom = await prisma.$transaction(async tx => {
      const departed = await tx.chatParticipant.updateMany({
        where: { id: participantB.id, room_id: room.id, is_active: true },
        data: { is_active: false, left_at: leftAt },
      });
      if (departed.count !== 1) throw Errors.CONFLICT('聊天室成員狀態已變更');
      await chatAnalysisRequestService.cancelActiveForParticipantDeparture(
        tx,
        room.id,
        participantB.id,
        leftAt,
      );
      if (
        room.status === ChatRoomStatus.group_active ||
        room.status === ChatRoomStatus.invite_pending ||
        room.status === ChatRoomStatus.solo_active
      ) {
        await tx.chatRoom.updateMany({
          where: { id: room.id, status: room.status },
          data: { status: ChatRoomStatus.solo_active },
        });
      }
      return tx.chatRoom.findUnique({
        where: { id: room.id },
        include: { participants: true },
      });
    });
    chatStreamEntitlementService.revokeParticipant(participantB.id);
    if (!updatedRoom) throw Errors.NOT_FOUND('聊天室不存在');
    return updatedRoom;
  }
}

export const chatService = new ChatService();
