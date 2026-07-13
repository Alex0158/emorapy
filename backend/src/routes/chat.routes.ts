import { Request, Router } from 'express';
import { optionalAuthenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import { getAuthUserIdOptional, getSessionIdFromSources } from '../utils/request';
import { chatService } from '../services/chat.service';
import { Errors } from '../utils/errors';
import { chatEventsService, type ChatStreamEvent } from '../services/chat-events.service';
import { isRoomWideChatMessage } from '../services/chat-message-audience-policy';
import { chatActorAccessService } from '../services/chat-actor-access.service';
import { chatSafetyRouterService } from '../services/chat-safety-router.service';
import { ChatSseEntitlementHandshake } from './chat-sse-entitlement-handshake';
import {
  acceptChatInviteSchema,
  chatRoomIdParamSchema,
  createChatInviteSchema,
  createChatRoomSchema,
  listChatMessagesSchema,
  sendChatMessageSchema,
  requestChatJudgmentSchema,
} from '../utils/validation';

const router = Router();

function getActorFromRequest(req: Request): { userId?: string; sessionId?: string } {
  const userId = getAuthUserIdOptional(req);
  const sessionCtx = getSessionIdFromSources(req);
  if (sessionCtx.hasConflict) {
    throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
  }
  return {
    userId,
    sessionId: sessionCtx.sessionId,
  };
}

router.post(
  '/rooms',
  generalLimiter,
  optionalAuthenticate,
  validate(createChatRoomSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const room = await chatService.createRoom(actor, {
        historyVisibilityMode: req.body.history_visibility_mode,
      });
      res.json({
        success: true,
        data: { room },
        message: '聊天室已建立',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/rooms/:roomId',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const room = await chatService.getRoom(req.params.roomId, actor);
      res.json({
        success: true,
        data: { room },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/rooms/:roomId/safety-status',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const status = await chatSafetyRouterService.getSanitizedSharedStatus(
        req.params.roomId,
        actor,
      );
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/rooms/:roomId/invites',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  validate(createChatInviteSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const invite = await chatService.createInvite(req.params.roomId, actor, {
        historyVisibilityMode: req.body.history_visibility_mode,
        expiresInHours: req.body.expires_in_hours,
      });
      chatEventsService.publish({
        type: 'invite',
        roomId: req.params.roomId,
        payload: {
          inviteId: invite.id,
          status: invite.status,
          inviteCode: invite.invite_code,
        },
        at: new Date().toISOString(),
      });
      res.json({
        success: true,
        data: { invite },
        message: '邀請已發送',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/invites/:inviteCode/accept',
  generalLimiter,
  optionalAuthenticate,
  validate(acceptChatInviteSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const room = await chatService.acceptInvite(req.params.inviteCode, actor);
      chatEventsService.publish({
        type: 'room_status',
        roomId: room.id,
        payload: {
          status: room.status,
          joined: true,
        },
        at: new Date().toISOString(),
      });
      res.json({
        success: true,
        data: { room },
        message: '已加入聊天室',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/invites/:inviteCode/decline',
  generalLimiter,
  optionalAuthenticate,
  validate(acceptChatInviteSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const invite = await chatService.declineInvite(req.params.inviteCode, actor);
      if (!invite) {
        throw Errors.NOT_FOUND('邀請不存在');
      }
      chatEventsService.publish({
        type: 'invite',
        roomId: invite.room_id,
        payload: {
          inviteId: invite.id,
          status: invite.status,
        },
        at: new Date().toISOString(),
      });
      res.json({
        success: true,
        data: { invite },
        message: '已拒絕邀請',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/rooms/:roomId/stream',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  async (req, res, next) => {
    let heartbeat: NodeJS.Timeout | undefined;
    let handshake: ChatSseEntitlementHandshake<ChatStreamEvent> | undefined;
    try {
      const actor = getActorFromRequest(req);
      const context = await chatActorAccessService.resolveActiveHumanParticipant(
        req.params.roomId,
        actor,
      );

      handshake = await ChatSseEntitlementHandshake.prepare({
        participantId: context.participant.id,
        deliver: event => {
          if (res.writableEnded || res.destroyed) return;
          res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        },
        onRevoked: () => {
          if (heartbeat) clearInterval(heartbeat);
          if (res.headersSent && !res.writableEnded) res.end();
        },
      });
      const unsubscribe = chatEventsService.subscribe(
        req.params.roomId,
        event => handshake?.push(event),
      );
      handshake.bindSubscription(unsubscribe);
      await handshake.confirmBeforeHeaders();

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      handshake.activateAndFlush(() => {
        res.write(`event: ready\ndata: ${JSON.stringify({ roomId: req.params.roomId })}\n\n`);
      });

      heartbeat = setInterval(() => {
        if (res.writableEnded || res.destroyed) return;
        res.write('event: ping\ndata: {}\n\n');
      }, 15000);

      req.on('close', () => {
        if (heartbeat) clearInterval(heartbeat);
        handshake?.dispose();
        if (!res.writableEnded) {
          res.end();
        }
      });
    } catch (error) {
      if (heartbeat) clearInterval(heartbeat);
      handshake?.dispose();
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      next(error);
    }
  }
);

router.get(
  '/rooms/:roomId/messages',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  validate(listChatMessagesSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const result = await chatService.listMessages(req.params.roomId, actor, {
        cursor: req.query.cursor as string | undefined,
        limit: Number(req.query.limit ?? 30),
      });
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/rooms/:roomId/request-judgment',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  validate(requestChatJudgmentSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const result = await chatService.requestJudgment(req.params.roomId, actor, {
        includedMessageIds: req.body?.included_message_ids,
        analysisRequestId: req.body?.analysis_request_id,
        locale: req.locale,
      });
      chatEventsService.publish({
        type: 'room_status',
        roomId: req.params.roomId,
        payload: {
          status: result.status,
          caseId: result.caseId,
          judgmentId: result.judgmentId,
          linkId: result.linkId,
        },
        at: new Date().toISOString(),
      });
      res.json({
        success: true,
        data: result,
        message: '已發起判決',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/rooms/:roomId/leave',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const room = await chatService.leaveRoom(req.params.roomId, actor);
      chatEventsService.publish({
        type: 'room_status',
        roomId: req.params.roomId,
        payload: {
          status: room.status,
          participantLeft: true,
        },
        at: new Date().toISOString(),
      });
      res.json({
        success: true,
        data: { room },
        message: '已離開聊天室',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/rooms/:roomId/kick-b',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const room = await chatService.kickParticipantB(req.params.roomId, actor);
      chatEventsService.publish({
        type: 'room_status',
        roomId: req.params.roomId,
        payload: {
          status: room.status,
          participantKicked: true,
        },
        at: new Date().toISOString(),
      });
      res.json({
        success: true,
        data: { room },
        message: '已移除 B 方',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/rooms/:roomId/judgment-status',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const status = await chatService.getJudgmentStatus(req.params.roomId, actor);
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/rooms/:roomId/messages',
  generalLimiter,
  optionalAuthenticate,
  validate(chatRoomIdParamSchema),
  validate(sendChatMessageSchema),
  async (req, res, next) => {
    try {
      const actor = getActorFromRequest(req);
      const message = await chatService.sendMessage(req.params.roomId, actor, {
        content: req.body.content,
        visibilityScope: req.body.visibility_scope ?? 'all',
        replyToMessageId: req.body.reply_to_message_id,
        locale: req.locale,
      });
      if (isRoomWideChatMessage(message.visibility_scope)) {
        chatEventsService.publish({
          type: 'message',
          roomId: req.params.roomId,
          payload: {
            messageId: message.id,
            senderParticipantId: message.sender_participant_id,
            messageType: message.message_type,
            visibilityScope: message.visibility_scope,
          },
          at: new Date().toISOString(),
        });
      }
      res.json({
        success: true,
        data: { message },
        message: '訊息已發送',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
