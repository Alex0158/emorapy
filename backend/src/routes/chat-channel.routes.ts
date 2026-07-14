import { Router } from 'express';
import Joi from 'joi';
import { optionalAuthenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import { chatChannelService } from '../services/chat-channel.service';
import { chatContextPreferenceService } from '../services/chat-context-preference.service';
import { chatEventsService, type ChatStreamEvent } from '../services/chat-events.service';
import { isRoomWideChatMessage } from '../services/chat-message-audience-policy';
import { chatService } from '../services/chat.service';
import { getChatActorFromRequest } from './chat-route-actor';
import { ChatSseEntitlementHandshake } from './chat-sse-entitlement-handshake';
import { updateSharedAdaptationConsentSchema } from '../utils/chat-context-validation';

const router = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roomIdParamsSchema = {
  params: Joi.object({ roomId: Joi.string().pattern(uuidPattern).required() }),
};
const channelIdParamsSchema = {
  params: Joi.object({ channelId: Joi.string().pattern(uuidPattern).required() }),
};
const listChannelMessagesSchema = {
  query: Joi.object({
    cursor: Joi.string().isoDate().optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};
const sendChannelMessageSchema = {
  body: Joi.object({
    content: Joi.string().trim().min(1).max(4000).required(),
    reply_to_message_id: Joi.string().pattern(uuidPattern).optional(),
  }),
};
const updatePrivateContextPreferenceSchema = {
  body: Joi.object({
    mode: Joi.string().valid('private_only', 'shared_process_controls').required(),
    policy_version: Joi.string().max(50).optional(),
  }),
};

router.get(
  '/rooms/:roomId/channels',
  generalLimiter,
  optionalAuthenticate,
  validate(roomIdParamsSchema),
  async (req, res, next) => {
    try {
      const channels = await chatChannelService.listActorChannels(
        req.params.roomId,
        getChatActorFromRequest(req),
      );
      res.json({ success: true, data: { channels } });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/rooms/:roomId/context-preference',
  generalLimiter,
  optionalAuthenticate,
  validate(roomIdParamsSchema),
  async (req, res, next) => {
    try {
      const preference = await chatContextPreferenceService.get(
        req.params.roomId,
        getChatActorFromRequest(req),
      );
      res.json({
        success: true,
        data: { preference },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/rooms/:roomId/context-preference',
  generalLimiter,
  optionalAuthenticate,
  validate(roomIdParamsSchema),
  validate(updatePrivateContextPreferenceSchema),
  async (req, res, next) => {
    try {
      const preference = await chatContextPreferenceService.update(
        req.params.roomId,
        getChatActorFromRequest(req),
        req.body.mode,
        req.body.policy_version,
      );
      res.json({
        success: true,
        data: { preference },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/rooms/:roomId/adaptation-consent',
  generalLimiter,
  optionalAuthenticate,
  validate(roomIdParamsSchema),
  validate(updateSharedAdaptationConsentSchema),
  async (req, res, next) => {
    try {
      const preference = await chatContextPreferenceService.updateAdaptationConsent(
        req.params.roomId,
        getChatActorFromRequest(req),
        req.body.decision,
        req.body.policy_version,
      );
      res.json({ success: true, data: { preference } });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/channels/:channelId/messages',
  generalLimiter,
  optionalAuthenticate,
  validate(channelIdParamsSchema),
  validate(listChannelMessagesSchema),
  async (req, res, next) => {
    try {
      const result = await chatChannelService.listMessages(
        req.params.channelId,
        getChatActorFromRequest(req),
        {
          cursor: req.query.cursor as string | undefined,
          limit: Number(req.query.limit ?? 30),
        },
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/channels/:channelId/messages',
  generalLimiter,
  optionalAuthenticate,
  validate(channelIdParamsSchema),
  validate(sendChannelMessageSchema),
  async (req, res, next) => {
    try {
      const message = await chatService.sendMessageToChannel(
        req.params.channelId,
        getChatActorFromRequest(req),
        {
          content: req.body.content,
          replyToMessageId: req.body.reply_to_message_id,
          locale: req.locale,
        },
      );
      const event = {
        type: 'message' as const,
        roomId: message.room_id,
        channelId: req.params.channelId,
        payload: {
          messageId: message.id,
          senderParticipantId: message.sender_participant_id,
          messageType: message.message_type,
          visibilityScope: message.visibility_scope,
        },
        at: new Date().toISOString(),
      };

      chatEventsService.publishToChannel(event);
      if (
        message.channel?.kind === 'shared'
        && isRoomWideChatMessage(message.visibility_scope)
      ) {
        chatEventsService.publish(event);
      }

      res.json({
        success: true,
        data: { message },
        message: '訊息已發送',
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/channels/:channelId/stream',
  generalLimiter,
  optionalAuthenticate,
  validate(channelIdParamsSchema),
  async (req, res, next) => {
    let heartbeat: NodeJS.Timeout | undefined;
    let handshake: ChatSseEntitlementHandshake<ChatStreamEvent> | undefined;
    try {
      const context = await chatChannelService.resolveAccessibleChannel(
        req.params.channelId,
        getChatActorFromRequest(req),
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
      const unsubscribe = chatEventsService.subscribeChannel(
        context.channel.id,
        event => handshake?.push(event),
      );
      handshake.bindSubscription(unsubscribe);
      await handshake.confirmBeforeHeaders();

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      handshake.activateAndFlush(() => {
        res.write(`event: ready\ndata: ${JSON.stringify({
          roomId: context.room.id,
          channelId: context.channel.id,
          channelKind: context.channel.kind,
        })}\n\n`);
      });

      heartbeat = setInterval(() => {
        if (res.writableEnded || res.destroyed) return;
        res.write('event: ping\ndata: {}\n\n');
      }, 15000);

      req.on('close', () => {
        if (heartbeat) clearInterval(heartbeat);
        handshake?.dispose();
        if (!res.writableEnded) res.end();
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
  },
);

export default router;
