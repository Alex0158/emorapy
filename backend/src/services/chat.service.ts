import {
  CaseMode,
  CaseStatus,
  ChatHistoryVisibilityMode,
  ChatInviteStatus,
  ChatRoomStatus,
  ChatVisibilityScope,
  PairingStatus,
  PairingType,
  Prisma,
} from '@prisma/client';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import { generateInviteCode, validateSessionId } from '../utils/session';
import { sessionService } from './session.service';
import { pairingService } from './pairing.service';
import { aiService } from './ai.service';
import { judgmentService } from './judgment.service';
import logger from '../config/logger';
import { lockService } from '../utils/lock';
import { LOCK_TTL } from '../utils/constants';
import { safetyRoutingService, type JudgmentRoute } from './safety-routing.service';
import { chatAIOrchestrator } from './chat-ai-orchestrator.service';
import { chatMetricsService } from './chat-metrics.service';
import { analyzeMessageLayers, buildChatJudgmentStatement } from './chat-message-analysis';
import { getChatJudgmentRequestPolicy } from '../utils/product-safety-policy';
import { safetyAssessmentService } from './safety-assessment.service';

type ActorContext = {
  userId?: string;
  sessionId?: string;
};

type CreateRoomInput = {
  historyVisibilityMode?: ChatHistoryVisibilityMode;
};

type CreateInviteInput = {
  historyVisibilityMode?: ChatHistoryVisibilityMode;
  expiresInHours?: number;
};

type ListMessagesInput = {
  cursor?: string;
  limit: number;
};

type SendMessageInput = {
  content: string;
  visibilityScope: ChatVisibilityScope;
  replyToMessageId?: string | null;
};

type RequestJudgmentOptions = {
  includedMessageIds?: string[];
  participantConsent?: {
    roleBIncludedMessages?: boolean;
  };
};

type RequestJudgmentResult = {
  roomId: string;
  caseId: string;
  judgmentId?: string;
  linkId?: string;
  status: ChatRoomStatus;
};

export class ChatService {
  private inFlightJudgmentByRoom = new Map<string, Promise<RequestJudgmentResult>>();
  private roomMessageTimestamps = new Map<string, number[]>();
  private readonly ROOM_RATE_WINDOW_MS = 30_000;
  private readonly ROOM_RATE_MAX = 6;
  private readonly ROOM_MIN_INTERVAL_MS = 5_000;
  private readonly INVITE_COOLDOWN_MS = 60_000;
  private readonly INVITE_DECLINED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  private async recordChatRouteSafetyAssessmentBestEffort(input: {
    roomId: string;
    route: JudgmentRoute;
    reasons: string[];
    detectedFlags: string[];
    assessedByUserId?: string | null;
    outcome: 'blocked' | 'judgment_completed';
    caseId?: string | null;
    linkId?: string | null;
    judgmentId?: string | null;
    firstMessageId?: string | null;
    lastMessageId?: string | null;
    totalUserMessages: number;
    roleAMessageCount: number;
    roleBMessageCount: number;
    roleBMessagesIncluded: boolean;
    roleBConsentAsserted: boolean;
    roleBParticipantId?: string | null;
    roleBUserId?: string | null;
    informationGaps: string[];
    transformConfidence: string;
  }) {
    try {
      await safetyAssessmentService.recordRouteAssessment(
        { subjectType: 'chat_room', subjectId: input.roomId },
        input.route,
        {
          source: 'chat_judgment_policy',
          reasons: input.reasons,
          assessedByUserId: input.assessedByUserId ?? null,
          updateActiveRiskState: input.route !== 'standard',
          metadata: {
            outcome: input.outcome,
            room_id: input.roomId,
            case_id: input.caseId ?? null,
            link_id: input.linkId ?? null,
            judgment_id: input.judgmentId ?? null,
            detected_flags: input.detectedFlags,
            source_message_range: {
              first_message_id: input.firstMessageId ?? null,
              last_message_id: input.lastMessageId ?? null,
              total_user_messages: input.totalUserMessages,
            },
            participant_consent: {
              role_b_messages_included: input.roleBMessagesIncluded,
              role_b_inclusion_consent_asserted: input.roleBConsentAsserted,
              role_b_consent_required: input.roleBMessagesIncluded,
              role_b_participant_id: input.roleBParticipantId ?? null,
              role_b_user_id: input.roleBUserId ?? null,
            },
            layer_summary: {
              role_a_messages: input.roleAMessageCount,
              role_b_messages: input.roleBMessageCount,
              information_gaps: input.informationGaps,
              transform_confidence: input.transformConfidence,
            },
          },
        }
      );
    } catch (error) {
      logger.warn('Chat route safety assessment persistence failed', {
        roomId: input.roomId,
        route: input.route,
        outcome: input.outcome,
        caseId: input.caseId,
        linkId: input.linkId,
        judgmentId: input.judgmentId,
        error,
      });
    }
  }

  private checkRoomRateLimit(roomId: string) {
    const now = Date.now();
    const list = (this.roomMessageTimestamps.get(roomId) ?? []).filter((ts) => now - ts <= this.ROOM_RATE_WINDOW_MS);
    if (list.length > 0 && now - list[list.length - 1] < this.ROOM_MIN_INTERVAL_MS) {
      chatMetricsService.recordRateLimit().catch(() => undefined);
      throw Errors.RATE_LIMIT_EXCEEDED('訊息發送過於頻繁，請稍後再試');
    }
    if (list.length >= this.ROOM_RATE_MAX) {
      chatMetricsService.recordRateLimit().catch(() => undefined);
      throw Errors.RATE_LIMIT_EXCEEDED('訊息發送過於頻繁，請稍後再試');
    }
    list.push(now);
    this.roomMessageTimestamps.set(roomId, list);
  }

  private async ensurePairingForRoom(
    room: Awaited<ReturnType<ChatService['getAccessibleRoom']>>,
    roleBUserId?: string | null
  ): Promise<string> {
    if (!room.owner_user_id) {
      if (!room.session_id) {
        throw Errors.SESSION_ID_REQUIRED('匿名聊天室缺少 session_id，無法轉判決');
      }
      const existingTempPairing = await pairingService.getPairingBySessionId(room.session_id);
      const tempPairing = existingTempPairing || await pairingService.createTempPairing(room.session_id);
      return tempPairing.id;
    }

    // 單人登入房先建立專屬 pending pairing，避免跨聊天室共用同一 pairing 導致資料耦合。
    if (!roleBUserId) {
      const created = await prisma.pairing.create({
        data: {
          user1_id: room.owner_user_id,
          user2_id: null,
          invite_code: null,
          status: PairingStatus.pending,
          pairing_type: PairingType.normal,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          confirmed_at: null,
        },
      });
      return created.id;
    }

    const existing = await prisma.pairing.findFirst({
      where: {
        pairing_type: PairingType.normal,
        OR: [
          { user1_id: room.owner_user_id, user2_id: roleBUserId },
          { user1_id: roleBUserId, user2_id: room.owner_user_id },
        ],
      },
      orderBy: { created_at: 'desc' },
    });

    if (existing) {
      if (existing.status === PairingStatus.active || existing.status === PairingStatus.pending) {
        return existing.id;
      }
      const reopened = await prisma.pairing.update({
        where: { id: existing.id },
        data: {
          status: roleBUserId ? PairingStatus.active : PairingStatus.pending,
          user1_id: existing.user1_id ?? room.owner_user_id,
          user2_id: roleBUserId ?? existing.user2_id,
          confirmed_at: roleBUserId ? new Date() : existing.confirmed_at,
        },
      });
      return reopened.id;
    }

    const created = await prisma.pairing.create({
      data: {
        user1_id: room.owner_user_id,
        user2_id: roleBUserId ?? null,
        invite_code: null,
        status: roleBUserId ? PairingStatus.active : PairingStatus.pending,
        pairing_type: PairingType.normal,
        expires_at: roleBUserId ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
        confirmed_at: roleBUserId ? new Date() : null,
      },
    });

    return created.id;
  }

  private async ensureActor(actor: ActorContext): Promise<ActorContext> {
    if (actor.userId) {
      return { userId: actor.userId, sessionId: undefined };
    }

    if (!actor.sessionId) {
      throw Errors.SESSION_ID_REQUIRED('未登入用戶需要提供有效 session');
    }

    if (!validateSessionId(actor.sessionId)) {
      throw Errors.INVALID_SESSION_ID('Session ID 格式無效');
    }

    const session = await sessionService.getSession(actor.sessionId);
    if (!session) {
      throw Errors.SESSION_EXPIRED();
    }

    return { userId: undefined, sessionId: actor.sessionId };
  }

  private async getAccessibleRoom(roomId: string, actor: ActorContext) {
    if (actor.userId) {
      const room = await prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          OR: [
            { owner_user_id: actor.userId },
            {
              participants: {
                some: {
                  user_id: actor.userId,
                  is_active: true,
                },
              },
            },
          ],
        },
        include: {
          participants: true,
        },
      });
      if (!room) {
        throw Errors.FORBIDDEN('你沒有該聊天室權限');
      }
      return room;
    }

    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        session_id: actor.sessionId,
      },
      include: {
        participants: true,
      },
    });
    if (!room) {
      throw Errors.FORBIDDEN('你沒有該聊天室權限');
    }
    return room;
  }

  private getCurrentParticipant(
    room: Awaited<ReturnType<ChatService['getAccessibleRoom']>>,
    actor: ActorContext
  ) {
    if (actor.userId) {
      return room.participants.find((p) => p.user_id === actor.userId && p.is_active);
    }
    return room.participants.find((p) => p.role_in_room === 'roleA' && !p.user_id && p.is_active);
  }

  async createRoom(actor: ActorContext, input: CreateRoomInput) {
    const resolvedActor = await this.ensureActor(actor);
    const visibilityMode = input.historyVisibilityMode ?? ChatHistoryVisibilityMode.share_summary_only;

    return prisma.$transaction(async (tx) => {
      const room = await tx.chatRoom.create({
        data: {
          owner_user_id: resolvedActor.userId ?? null,
          session_id: resolvedActor.sessionId ?? null,
          status: ChatRoomStatus.solo_active,
          history_visibility_mode: visibilityMode,
        },
      });

      await tx.chatParticipant.create({
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
      return await prisma.$transaction(async (tx) => {
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
          },
          orderBy: { joined_at: 'desc' },
        });

        if (existingRoleB) {
          await tx.chatParticipant.update({
            where: { id: existingRoleB.id },
            data: {
              participant_type: 'user',
              user_id: resolvedActor.userId,
              is_active: true,
              left_at: null,
            },
          });
        } else {
          await tx.chatParticipant.create({
            data: {
              room_id: invite.room_id,
              participant_type: 'user',
              user_id: resolvedActor.userId,
              role_in_room: 'roleB',
            },
          });
        }

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

  async listMessages(roomId: string, actor: ActorContext, input: ListMessagesInput) {
    const resolvedActor = await this.ensureActor(actor);
    const room = await this.getAccessibleRoom(roomId, resolvedActor);
    const participant = this.getCurrentParticipant(room, resolvedActor);
    const isOwner = participant?.role_in_room === 'roleA';
    const cursorDate = input.cursor ? new Date(input.cursor) : undefined;

    if (input.cursor && Number.isNaN(cursorDate?.getTime())) {
      throw Errors.VALIDATION_ERROR('cursor 必須為有效 ISO 時間');
    }

    const nonOwnerVisibility = (() => {
      const baseVisible = { visibility_scope: { in: [ChatVisibilityScope.all, ChatVisibilityScope.summary_only] } };
      if (participant?.role_in_room !== 'roleB' || !participant.joined_at) {
        return baseVisible;
      }

      if (room.history_visibility_mode === ChatHistoryVisibilityMode.share_full_history) {
        return baseVisible;
      }

      if (room.history_visibility_mode === ChatHistoryVisibilityMode.share_from_join_time) {
        return {
          AND: [
            baseVisible,
            { created_at: { gte: participant.joined_at } },
          ],
        };
      }

      // share_summary_only:
      // - 加入後可看一般訊息
      // - 加入前僅可看 summary_only
      return {
        OR: [
          {
            AND: [
              baseVisible,
              { created_at: { gte: participant.joined_at } },
            ],
          },
          { visibility_scope: ChatVisibilityScope.summary_only },
        ],
      };
    })();

    const messages = await prisma.chatMessage.findMany({
      where: {
        room_id: room.id,
        ...(cursorDate ? { created_at: { lt: cursorDate } } : {}),
        ...(isOwner ? {} : nonOwnerVisibility),
      },
      orderBy: { created_at: 'desc' },
      take: input.limit,
      include: {
        sender_participant: true,
      },
    });

    const normalized = messages.reverse();
    const nextCursor = normalized.length > 0 ? normalized[0].created_at.toISOString() : null;

    return {
      messages: normalized,
      nextCursor,
    };
  }

  async sendMessage(roomId: string, actor: ActorContext, input: SendMessageInput) {
    const resolvedActor = await this.ensureActor(actor);
    const room = await this.getAccessibleRoom(roomId, resolvedActor);
    const participant = this.getCurrentParticipant(room, resolvedActor);

    if (!participant || (participant.role_in_room !== 'roleA' && participant.role_in_room !== 'roleB')) {
      throw Errors.FORBIDDEN('只有聊天室成員可發言');
    }

    if (
      room.status !== ChatRoomStatus.solo_active &&
      room.status !== ChatRoomStatus.invite_pending &&
      room.status !== ChatRoomStatus.group_active
    ) {
      throw Errors.CASE_NOT_EDITABLE('當前狀態不可發送訊息');
    }

    this.checkRoomRateLimit(room.id);

    let replyTarget: { id: string } | null = null;
    if (input.replyToMessageId) {
      replyTarget = await prisma.chatMessage.findFirst({
        where: {
          id: input.replyToMessageId,
          room_id: room.id,
        },
        select: { id: true },
      });
      if (!replyTarget) {
        throw Errors.NOT_FOUND('回覆的訊息不存在');
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        room_id: room.id,
        sender_participant_id: participant.id,
        content: input.content.trim(),
        message_type: 'user_text',
        visibility_scope: input.visibilityScope,
        reply_to_message_id: replyTarget?.id ?? null,
      },
      include: {
        sender_participant: true,
      },
    });
    chatMetricsService.recordMessage().catch(() => undefined);

    // 非阻塞觸發 AI 介入
    void chatAIOrchestrator.onUserMessage(
      {
        roomId: room.id,
        roomStatus: room.status,
        aiParticipant: room.participants.find((p) => p.role_in_room === 'aiMediator' && p.is_active),
      },
      message.sender_participant,
      { id: message.id, content: message.content, visibility_scope: message.visibility_scope }
    );

    return message;
  }

  async requestJudgment(roomId: string, actor: ActorContext, options?: RequestJudgmentOptions): Promise<RequestJudgmentResult> {
    const resolvedActor = await this.ensureActor(actor);
    const preCheckRoom = await this.getAccessibleRoom(roomId, resolvedActor);
    const preCheckParticipant = this.getCurrentParticipant(preCheckRoom, resolvedActor);
    if (!preCheckParticipant || (preCheckParticipant.role_in_room !== 'roleA' && preCheckParticipant.role_in_room !== 'roleB')) {
      throw Errors.FORBIDDEN('只有聊天室成員可發起判決');
    }
    if (preCheckParticipant.role_in_room !== 'roleA') {
      throw Errors.FORBIDDEN('目前版本需由 A 方確認後發起判決');
    }

    const inFlight = this.inFlightJudgmentByRoom.get(roomId);
    if (inFlight) {
      logger.info('Chat judgment in-flight dedupe hit', { roomId });
      return inFlight;
    }

    const task = lockService.withLock(`chat:judgment:${roomId}`, async () => {
      logger.info('Chat judgment requested', {
        roomId,
        actorUserId: resolvedActor.userId ?? null,
        actorSessionId: resolvedActor.sessionId ?? null,
      });
      // 鎖內刷新狀態，避免鎖外預檢到鎖內執行期間出現狀態漂移（如排隊後已完成判決）。
      const lockedRoomState = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: {
          status: true,
          history_visibility_mode: true,
        },
      });
      if (!lockedRoomState) {
        throw Errors.NOT_FOUND('聊天室不存在');
      }
      const room = {
        ...preCheckRoom,
        status: lockedRoomState.status,
        history_visibility_mode: lockedRoomState.history_visibility_mode,
      };
      const freshParticipant = await prisma.chatParticipant.findUnique({
        where: { id: preCheckParticipant.id },
      });
      if (!freshParticipant || !freshParticipant.is_active) {
        throw Errors.FORBIDDEN('只有聊天室成員可發起判決');
      }
      if (freshParticipant.room_id && freshParticipant.room_id !== room.id) {
        throw Errors.FORBIDDEN('只有聊天室成員可發起判決');
      }
      if (freshParticipant.role_in_room !== 'roleA') {
        throw Errors.FORBIDDEN('目前版本需由 A 方確認後發起判決');
      }
      const participant = freshParticipant;
      const activeParticipantsInLock = await prisma.chatParticipant.findMany({
        where: {
          room_id: room.id,
          is_active: true,
        },
      });
      if (activeParticipantsInLock.length === 0) {
        throw Errors.FORBIDDEN('只有聊天室成員可發起判決');
      }
      const participants = activeParticipantsInLock;
      if (room.status === ChatRoomStatus.judgment_requested) {
        throw Errors.CONFLICT('判決生成中，請稍後');
      }
      if (room.status === ChatRoomStatus.archived) {
        throw Errors.CASE_NOT_EDITABLE('封存聊天室不可再次發起判決');
      }

      // 防止網路抖動或重複點擊造成短時間重複建案
      const recentLink = await prisma.chatToCaseLink.findFirst({
        where: { room_id: room.id },
        orderBy: { created_at: 'desc' },
        include: {
          judgment: { select: { id: true } },
          case: { select: { id: true, status: true } },
        },
      });
      const hasNewUserMessagesSinceLink = recentLink
        ? (await prisma.chatMessage.count({
            where: {
              room_id: room.id,
              message_type: 'user_text',
              created_at: { gt: recentLink.created_at },
            },
          })) > 0
        : false;
      if (recentLink && room.status === ChatRoomStatus.judgment_completed) {
        const idempotentWindowMs = 2 * 60 * 1000;
        const ageMs = Date.now() - new Date(recentLink.created_at).getTime();
        if (!hasNewUserMessagesSinceLink) {
          logger.info('Chat judgment idempotent hit', {
            roomId: room.id,
            caseId: recentLink.case_id,
            linkId: recentLink.id,
            ageMs,
            hasNewUserMessagesSinceLink,
            withinWindow: ageMs <= idempotentWindowMs,
          });
          return {
            roomId: room.id,
            caseId: recentLink.case_id,
            judgmentId: recentLink.judgment?.id,
            linkId: recentLink.id,
            status: ChatRoomStatus.judgment_completed,
          };
        }
      }

      // 若上一次已建案但判決失敗，優先復用既有 case/link 重試，避免重複建案
      if (
        recentLink &&
        room.status === ChatRoomStatus.judgment_failed &&
        !recentLink.judgment &&
        recentLink.case &&
        !hasNewUserMessagesSinceLink &&
        new Set<CaseStatus>([CaseStatus.submitted, CaseStatus.in_progress, CaseStatus.judgment_failed]).has(recentLink.case.status)
      ) {
        const retryCaseId = recentLink.case_id;
        const retryLinkId = recentLink.id;
        const retryTransition = await prisma.chatRoom.updateMany({
          where: {
            id: room.id,
            status: ChatRoomStatus.judgment_failed,
          },
          data: { status: ChatRoomStatus.judgment_requested },
        });
        if (retryTransition.count === 0) {
          throw Errors.CONFLICT('聊天室狀態已變更，請重試');
        }
        try {
          const judgment = await judgmentService.generateJudgment(retryCaseId, {
            userId: resolvedActor.userId,
            sessionId: resolvedActor.sessionId,
          });
          const judgmentId = (judgment as { id?: string }).id;
          await prisma.$transaction(async (tx) => {
            await tx.chatRoom.update({
              where: { id: room.id },
              data: { status: ChatRoomStatus.judgment_completed },
            });
            if (judgmentId) {
              await tx.chatToCaseLink.update({
                where: { id: retryLinkId },
                data: { judgment_id: judgmentId },
              });
            }
          });
          return {
            roomId: room.id,
            caseId: retryCaseId,
            judgmentId,
            linkId: retryLinkId,
            status: ChatRoomStatus.judgment_completed,
          };
        } catch (error) {
          logger.warn('Chat judgment retry failed', { roomId: room.id, retryCaseId, retryLinkId, error });
          await prisma.chatRoom.update({
            where: { id: room.id },
            data: { status: ChatRoomStatus.judgment_failed },
          }).catch(() => undefined);
          throw error;
        }
      }

      const roleAParticipants = participants.filter((p) => p.role_in_room === 'roleA');
      const roleBParticipants = participants.filter((p) => p.role_in_room === 'roleB');
      const aiParticipants = participants.filter((p) => p.role_in_room === 'aiMediator');
      if (roleAParticipants.length !== 1 || roleBParticipants.length > 1 || aiParticipants.length > 1) {
        throw Errors.CONFLICT('聊天室參與者狀態異常，請刷新後重試');
      }
      const roleAParticipant = roleAParticipants[0];
      const roleBParticipant = roleBParticipants[0];
      const aiParticipant = aiParticipants[0];
      if (!roleAParticipant) {
        throw Errors.CASE_NOT_READY('缺少發起方資訊，無法轉判決');
      }

      const visibilityFilteredWhere: Prisma.ChatMessageWhereInput = {
        room_id: room.id,
        message_type: 'user_text',
        visibility_scope: ChatVisibilityScope.all,
      };

      if (roleBParticipant?.joined_at) {
        if (room.history_visibility_mode === ChatHistoryVisibilityMode.share_from_join_time) {
          visibilityFilteredWhere.created_at = { gte: roleBParticipant.joined_at };
        }
        if (room.history_visibility_mode === ChatHistoryVisibilityMode.share_summary_only) {
          visibilityFilteredWhere.created_at = { gte: roleBParticipant.joined_at };
        }
      }

      let userMessages = await prisma.chatMessage.findMany({
        where: visibilityFilteredWhere,
        orderBy: { created_at: 'asc' },
        include: {
          sender_participant: true,
        },
      });

      if (options?.includedMessageIds && options.includedMessageIds.length > 0) {
        const allowedIds = new Set(userMessages.map((m) => m.id));
        const provided = options.includedMessageIds;
        const invalid = provided.filter((id) => !allowedIds.has(id));
        if (invalid.length > 0) {
          throw Errors.NOT_FOUND('部分訊息不存在或不可納入判決');
        }
        userMessages = userMessages.filter((m) => provided.includes(m.id));
        if (userMessages.length === 0) {
          throw Errors.CASE_NOT_READY('需至少 1 則訊息納入判決');
        }
      }

      const roleAMessages = userMessages
        .filter((m) => m.sender_participant.role_in_room === 'roleA')
        .map((m) => m.content);
      const roleBMessages = userMessages
        .filter((m) => m.sender_participant.role_in_room === 'roleB')
        .map((m) => m.content);
      const includesRoleBMessages = roleBMessages.length > 0;
      const roleBConsentAsserted = options?.participantConsent?.roleBIncludedMessages === true;
      const firstMessage = userMessages[0];
      const lastMessage = userMessages[userMessages.length - 1];

      if (roleAMessages.length === 0) {
        throw Errors.CASE_NOT_READY('A 方訊息不足，無法轉判決');
      }
      if (includesRoleBMessages && !roleBConsentAsserted) {
        throw Errors.CASE_NOT_READY('納入 B 方訊息前需要 B 方明示同意');
      }

      const plaintiffStatement = buildChatJudgmentStatement(roleAMessages, 30);
      const defendantStatement = roleBMessages.length > 0 ? buildChatJudgmentStatement(roleBMessages, 10) : null;
      const layerAnalysis = analyzeMessageLayers(roleAMessages, roleBMessages);

      const preRouteDecision = safetyRoutingService.decideRoute({
        plaintiffStatement,
        defendantStatement: defendantStatement ?? '',
      });
      const requestPolicy = getChatJudgmentRequestPolicy(preRouteDecision.route, preRouteDecision.reasons);
      if (requestPolicy.shouldCreateSafetyNotice && aiParticipant && requestPolicy.noticeMessage) {
        await prisma.chatMessage.create({
          data: {
            room_id: room.id,
            sender_participant_id: aiParticipant.id,
            message_type: 'safety_notice',
            visibility_scope: ChatVisibilityScope.all,
            content: requestPolicy.noticeMessage,
            safety_flag: true,
            safety_detail: preRouteDecision.detectedFlags.join('、'),
          },
        }).catch(() => undefined);
      }
      if (!requestPolicy.canRequestChatJudgment) {
        await this.recordChatRouteSafetyAssessmentBestEffort({
          roomId: room.id,
          route: preRouteDecision.route,
          reasons: requestPolicy.reasons,
          detectedFlags: preRouteDecision.detectedFlags,
          assessedByUserId: resolvedActor.userId ?? null,
          outcome: 'blocked',
          caseId: null,
          linkId: null,
          judgmentId: null,
          firstMessageId: firstMessage?.id ?? null,
          lastMessageId: lastMessage?.id ?? null,
          totalUserMessages: userMessages.length,
          roleAMessageCount: roleAMessages.length,
          roleBMessageCount: roleBMessages.length,
          roleBMessagesIncluded: includesRoleBMessages,
          roleBConsentAsserted,
          roleBParticipantId: roleBParticipant?.id ?? null,
          roleBUserId: roleBParticipant?.user_id ?? null,
          informationGaps: layerAnalysis.informationGaps,
          transformConfidence: layerAnalysis.confidence,
        });
        throw Errors.CASE_NOT_READY(requestPolicy.rejectionMessage ?? '目前安全路由不允許由聊天室直接轉判決');
      }

      let caseType = '其他衝突';
      try {
        caseType = await aiService.detectCaseType(plaintiffStatement, defendantStatement ?? '');
      } catch (error) {
        logger.warn('Chat judgment case type detect failed, fallback', { roomId, error });
      }

      const mode = room.owner_user_id ? CaseMode.collaborative : CaseMode.quick;
      const pairingId = await this.ensurePairingForRoom(room, roleBParticipant?.user_id ?? null);
      const now = new Date();
      const title = `聊天室轉判決-${now.toISOString().slice(0, 10)}`;

      let caseId = '';
      let linkId = '';

      try {
        const beginTransition = await prisma.chatRoom.updateMany({
          where: {
            id: room.id,
            status: {
              in: [
                ChatRoomStatus.solo_active,
                ChatRoomStatus.invite_pending,
                ChatRoomStatus.group_active,
                ChatRoomStatus.judgment_failed,
                ChatRoomStatus.judgment_completed,
              ],
            },
          },
          data: { status: ChatRoomStatus.judgment_requested },
        });
        if (beginTransition.count === 0) {
          throw Errors.CONFLICT('聊天室狀態已變更，請重試');
        }

        const created = await prisma.$transaction(async (tx) => {
          const caseRecord = await tx.case.create({
            data: {
              pairing_id: pairingId,
              title,
              type: caseType,
              plaintiff_id: roleAParticipant.user_id ?? null,
              defendant_id: roleBParticipant?.user_id ?? null,
              plaintiff_statement: plaintiffStatement,
              defendant_statement: defendantStatement,
              status: CaseStatus.submitted,
              mode,
              session_id: mode === CaseMode.quick ? room.session_id : null,
              submitted_at: new Date(),
            },
          });

          const link = await tx.chatToCaseLink.create({
            data: {
              room_id: room.id,
              case_id: caseRecord.id,
              triggered_by_participant_id: participant.id,
              conversion_snapshot: {
                source_message_range: {
                  first_message_id: firstMessage?.id ?? null,
                  first_message_at: firstMessage?.created_at?.toISOString?.() ?? null,
                  last_message_id: lastMessage?.id ?? null,
                  last_message_at: lastMessage?.created_at?.toISOString?.() ?? null,
                  total_user_messages: userMessages.length,
                },
                roleA_messages: roleAMessages.length,
                roleB_messages: roleBMessages.length,
                participant_consent: {
                  role_b_messages_included: includesRoleBMessages,
                  role_b_inclusion_consent_asserted: roleBConsentAsserted,
                  role_b_consent_required: includesRoleBMessages,
                  role_b_participant_id: roleBParticipant?.id ?? null,
                  role_b_user_id: roleBParticipant?.user_id ?? null,
                },
                room_status: room.status,
                visibility_mode: room.history_visibility_mode,
                pre_route: preRouteDecision.route,
                pre_route_reasons: preRouteDecision.reasons,
                pre_route_flags: preRouteDecision.detectedFlags,
                safety_gate: {
                  can_request_chat_judgment: requestPolicy.canRequestChatJudgment,
                  should_create_safety_notice: requestPolicy.shouldCreateSafetyNotice,
                  reasons: requestPolicy.reasons,
                },
                emotion_highlights: layerAnalysis.emotionHighlights,
                fact_highlights: layerAnalysis.factHighlights,
                interaction_hints: layerAnalysis.interactionHints,
                information_gaps: layerAnalysis.informationGaps,
                transform_confidence: layerAnalysis.confidence,
                layer_usability: layerAnalysis.layerUsability,
                gap_details: layerAnalysis.gapDetails,
                signal_stats: layerAnalysis.signalStats,
                included_message_ids: userMessages.map((m) => m.id),
                excluded_policy: {
                  filtered_visibility: true,
                  filtered_before_join:
                    !!roleBParticipant?.joined_at &&
                    (room.history_visibility_mode === ChatHistoryVisibilityMode.share_from_join_time
                      || room.history_visibility_mode === ChatHistoryVisibilityMode.share_summary_only),
                },
                conversion_version: 'v2-layered-2026-02',
                generated_at: new Date().toISOString(),
              },
            },
          });

          return { caseRecord, link };
        });

        caseId = created.caseRecord.id;
        linkId = created.link.id;

        const judgment = await judgmentService.generateJudgment(caseId, {
          userId: resolvedActor.userId,
          sessionId: resolvedActor.sessionId,
        });

        const judgmentId = (judgment as { id?: string }).id;
        await prisma.$transaction(async (tx) => {
          await tx.chatRoom.update({
            where: { id: room.id },
            data: { status: ChatRoomStatus.judgment_completed },
          });
          if (judgmentId) {
            await tx.chatToCaseLink.update({
              where: { id: linkId },
              data: { judgment_id: judgmentId },
            });
          }
        });
        chatMetricsService.recordJudgmentSuccess().catch(() => undefined);

        await this.recordChatRouteSafetyAssessmentBestEffort({
          roomId: room.id,
          route: preRouteDecision.route,
          reasons: requestPolicy.reasons,
          detectedFlags: preRouteDecision.detectedFlags,
          assessedByUserId: resolvedActor.userId ?? null,
          outcome: 'judgment_completed',
          caseId,
          linkId,
          judgmentId: judgmentId ?? null,
          firstMessageId: firstMessage?.id ?? null,
          lastMessageId: lastMessage?.id ?? null,
          totalUserMessages: userMessages.length,
          roleAMessageCount: roleAMessages.length,
          roleBMessageCount: roleBMessages.length,
          roleBMessagesIncluded: includesRoleBMessages,
          roleBConsentAsserted,
          roleBParticipantId: roleBParticipant?.id ?? null,
          roleBUserId: roleBParticipant?.user_id ?? null,
          informationGaps: layerAnalysis.informationGaps,
          transformConfidence: layerAnalysis.confidence,
        });

        return {
          roomId: room.id,
          caseId,
          judgmentId,
          linkId,
          status: ChatRoomStatus.judgment_completed,
        };
      } catch (error) {
        logger.warn('Chat judgment failed', { roomId: room.id, caseId, linkId, error });
        await prisma.chatRoom.update({
          where: { id: room.id },
          data: { status: ChatRoomStatus.judgment_failed },
        }).catch(() => undefined);
        chatMetricsService.recordJudgmentFailed().catch(() => undefined);
        throw error;
      }
    }, LOCK_TTL.JUDGMENT_GENERATION);

    this.inFlightJudgmentByRoom.set(roomId, task);
    try {
      return await task;
    } finally {
      if (this.inFlightJudgmentByRoom.get(roomId) === task) {
        this.inFlightJudgmentByRoom.delete(roomId);
      }
    }
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

    return {
      roomStatus: room?.status,
      latestLink: latest,
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
    await prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { is_active: false, left_at: new Date() },
    });

    if (
      room.status === ChatRoomStatus.group_active ||
      room.status === ChatRoomStatus.invite_pending ||
      room.status === ChatRoomStatus.solo_active
    ) {
      await prisma.chatRoom.update({
        where: { id: room.id },
        data: { status: ChatRoomStatus.solo_active },
      }).catch(() => undefined);
    }

    return this.getAccessibleRoom(roomId, resolvedActor);
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
    await prisma.chatParticipant.update({
      where: { id: participantB.id },
      data: { is_active: false, left_at: new Date() },
    });
    if (
      room.status === ChatRoomStatus.group_active ||
      room.status === ChatRoomStatus.invite_pending ||
      room.status === ChatRoomStatus.solo_active
    ) {
      await prisma.chatRoom.update({
        where: { id: room.id },
        data: { status: ChatRoomStatus.solo_active },
      }).catch(() => undefined);
    }
    return this.getAccessibleRoom(roomId, resolvedActor);
  }
}

export const chatService = new ChatService();
