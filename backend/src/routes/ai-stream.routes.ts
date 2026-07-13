import { Router } from 'express';
import { optionalAuthenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { Errors } from '../utils/errors';
import { aiStreamService } from '../services/ai-stream.service';
import { assertAIStreamScopeAccess, isAIStreamScopeType } from './ai-stream-scope-access';
import { getChatActorFromRequest } from './chat-route-actor';
import { chatStreamEntitlementService } from '../services/chat-stream-entitlement.service';
import type { AIStreamEvent } from '../types/ai-stream';

const router = Router();

router.get('/:scopeType/:scopeId', generalLimiter, optionalAuthenticate, async (req, res, next) => {
  let clientClosed = false;
  let unsubscribe: () => void = () => undefined;
  let unregisterEntitlement: () => void = () => undefined;
  let heartbeat: NodeJS.Timeout | undefined;
  try {
    const scopeTypeParam = req.params.scopeType;
    if (!isAIStreamScopeType(scopeTypeParam)) {
      throw Errors.VALIDATION_ERROR('未知的 AI stream scopeType');
    }

    const access = await assertAIStreamScopeAccess(
      scopeTypeParam,
      req.params.scopeId,
      getChatActorFromRequest(req),
    );

    const afterSeqRaw = req.query.after_seq;
    const afterSeq = typeof afterSeqRaw === 'string' ? Number.parseInt(afterSeqRaw, 10) || 0 : 0;

    const bufferedEvents: AIStreamEvent[] = [];
    let headersReady = false;
    if (access.chatParticipantId) {
      unregisterEntitlement = chatStreamEntitlementService.watchParticipant(
        access.chatParticipantId,
        () => {
          clientClosed = true;
          if (heartbeat) clearInterval(heartbeat);
          unsubscribe();
          if (res.headersSent && !res.writableEnded) res.end();
        },
      );
      if (!await chatStreamEntitlementService.revalidateParticipantNow(
        access.chatParticipantId,
      )) {
        throw Errors.FORBIDDEN('聊天室參與者權限已失效');
      }
    }

    unsubscribe = await aiStreamService.subscribe(
      scopeTypeParam,
      req.params.scopeId,
      (event) => {
        if (clientClosed || res.writableEnded || res.destroyed) return;
        if (!headersReady) {
          bufferedEvents.push(event);
          return;
        }
        res.write(`event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      },
      { afterSeq, notBefore: access.replayNotBefore },
    );
    const snapshots = await aiStreamService.getSnapshots(
      scopeTypeParam,
      req.params.scopeId,
      { notBefore: access.replayNotBefore },
    );
    if (access.chatParticipantId) {
      const stillActive = await chatStreamEntitlementService.revalidateParticipantNow(
        access.chatParticipantId,
      );
      if (!stillActive || clientClosed) {
        throw Errors.FORBIDDEN('聊天室參與者權限已失效');
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    headersReady = true;
    bufferedEvents.forEach(event => {
      if (!clientClosed && !res.writableEnded && !res.destroyed) {
        res.write(`event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    });
    res.write(`event: ready\ndata: ${JSON.stringify({
      scopeType: scopeTypeParam,
      scopeId: req.params.scopeId,
      snapshots,
    })}\n\n`);

    if (!clientClosed) {
      heartbeat = setInterval(() => {
        if (clientClosed || res.writableEnded || res.destroyed) return;
        void aiStreamService.emitScopeHeartbeat(scopeTypeParam, req.params.scopeId);
      }, 15000);
    }

    req.on('close', () => {
      clientClosed = true;
      if (heartbeat) clearInterval(heartbeat);
      unregisterEntitlement();
      unsubscribe();
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (error) {
    if (heartbeat) clearInterval(heartbeat);
    unregisterEntitlement();
    unsubscribe();
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    next(error);
  }
});

export default router;
