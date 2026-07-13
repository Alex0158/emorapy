import { ChatRoleInRoom, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { Errors } from '../utils/errors';
import { validateSessionId } from '../utils/session';
import { sessionService } from './session.service';

export type ChatActorContext = {
  userId?: string;
  sessionId?: string;
};

export type AccessibleChatRoom = Prisma.ChatRoomGetPayload<{
  include: { participants: true };
}>;

type ChatRoomAccessDb = Pick<Prisma.TransactionClient, 'chatRoom'>;
type ChatEntitlementLockDb = Pick<Prisma.TransactionClient, '$queryRaw'>;

const HUMAN_CHAT_ROLES = new Set<ChatRoleInRoom>([
  ChatRoleInRoom.roleA,
  ChatRoleInRoom.roleB,
]);

export class ChatActorAccessService {
  async ensureActor(actor: ChatActorContext): Promise<ChatActorContext> {
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

  async getAccessibleRoom(
    roomId: string,
    actor: ChatActorContext,
    db: ChatRoomAccessDb = prisma,
  ): Promise<AccessibleChatRoom> {
    const ownershipWhere: Prisma.ChatRoomWhereInput = actor.userId
      ? {
          OR: [
            { owner_user_id: actor.userId },
            {
              participants: {
                some: { user_id: actor.userId, is_active: true },
              },
            },
          ],
        }
      : { session_id: actor.sessionId };

    const room = await db.chatRoom.findFirst({
      where: { id: roomId, ...ownershipWhere },
      include: { participants: true },
    });
    if (!room) {
      throw Errors.FORBIDDEN('你沒有該聊天室權限');
    }
    return room;
  }

  getCurrentParticipant(room: AccessibleChatRoom, actor: ChatActorContext) {
    if (actor.userId) {
      return room.participants.find((participant) => (
        participant.user_id === actor.userId
        && participant.participant_type === 'user'
        && participant.is_active
        && participant.left_at === null
      ));
    }
    return room.participants.find((participant) => (
      participant.role_in_room === ChatRoleInRoom.roleA
      && participant.participant_type === 'user'
      && !participant.user_id
      && participant.is_active
      && participant.left_at === null
    ));
  }

  async resolveActiveHumanParticipant(
    roomId: string,
    actor: ChatActorContext,
    db: ChatRoomAccessDb = prisma,
  ) {
    const resolvedActor = await this.ensureActor(actor);
    const room = await this.getAccessibleRoom(roomId, resolvedActor, db);
    const participant = this.getCurrentParticipant(room, resolvedActor);
    if (
      !participant
      || participant.participant_type !== 'user'
      || participant.left_at !== null
      || !HUMAN_CHAT_ROLES.has(participant.role_in_room)
    ) {
      throw Errors.FORBIDDEN('只有聊天室中的有效參與者可執行此操作');
    }
    return { actor: resolvedActor, room, participant };
  }

  async lockActiveParticipant(
    db: ChatEntitlementLockDb,
    roomId: string,
    participantId: string,
  ): Promise<void> {
    const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM chat_participants
      WHERE id = ${participantId}
        AND room_id = ${roomId}
        AND participant_type = 'user'
        AND is_active = true
        AND left_at IS NULL
      FOR UPDATE
    `);
    if (rows.length !== 1) {
      throw Errors.FORBIDDEN('聊天室參與者權限已失效');
    }
  }

  async lockActiveRoleB(
    db: ChatEntitlementLockDb,
    roomId: string,
  ): Promise<void> {
    const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM chat_participants
      WHERE room_id = ${roomId}
        AND participant_type = 'user'
        AND role_in_room = 'roleB'
        AND is_active = true
        AND left_at IS NULL
      FOR UPDATE
    `);
    if (rows.length !== 1) {
      throw Errors.CASE_NOT_EDITABLE('對方加入後才可發送共同訊息');
    }
  }
}

export const chatActorAccessService = new ChatActorAccessService();
