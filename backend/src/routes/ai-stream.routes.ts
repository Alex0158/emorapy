import { Router, type Response } from 'express';
import { optionalAuthenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { Errors } from '../utils/errors';
import { aiStreamService } from '../services/ai-stream.service';
import { assertAIStreamScopeAccess, isAIStreamScopeType } from './ai-stream-scope-access';
import { getChatActorFromRequest } from './chat-route-actor';
import { ChatSseEntitlementHandshake } from './chat-sse-entitlement-handshake';
import type { AIStreamEvent, AIStreamSnapshot } from '../types/ai-stream';

const router = Router();

type ProtectedAIStreamPayload =
  | { kind: 'event'; event: AIStreamEvent }
  | {
      kind: 'ready';
      scopeType: AIStreamEvent['scopeType'];
      scopeId: string;
      snapshots: AIStreamSnapshot[];
    };

function writeProtectedPayload(
  res: Response,
  payload: ProtectedAIStreamPayload,
): void {
  if (res.writableEnded || res.destroyed) return;
  if (payload.kind === 'event') {
    res.write(`event: ${payload.event.eventType}\ndata: ${JSON.stringify(payload.event)}\n\n`);
    return;
  }
  res.write(`event: ready\ndata: ${JSON.stringify({
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
    snapshots: payload.snapshots,
  })}\n\n`);
}

router.get('/:scopeType/:scopeId', generalLimiter, optionalAuthenticate, async (req, res, next) => {
  let clientClosed = false;
  let transportClosed = false;
  let unsubscribe: () => void = () => undefined;
  let entitlementHandshake: ChatSseEntitlementHandshake<ProtectedAIStreamPayload> | undefined;
  let heartbeat: NodeJS.Timeout | undefined;
  const setupAbortController = new AbortController();

  const releaseResources = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = undefined;
    }
    entitlementHandshake?.dispose();
    unsubscribe();
  };
  const handleTransportClose = () => {
    if (transportClosed) return;
    transportClosed = true;
    clientClosed = true;
    setupAbortController.abort();
    releaseResources();
  };

  // Register before the first asynchronous access check. Otherwise a client
  // that disconnects during setup can leave a late subscription and heartbeat
  // alive after the close event has already been missed.
  res.once('close', handleTransportClose);

  try {
    const scopeTypeParam = req.params.scopeType;
    if (!isAIStreamScopeType(scopeTypeParam)) {
      throw Errors.VALIDATION_ERROR('未知的 AI stream scopeType');
    }

    const actor = getChatActorFromRequest(req);
    const access = await assertAIStreamScopeAccess(
      scopeTypeParam,
      req.params.scopeId,
      actor,
    );
    if (transportClosed || res.destroyed) return;

    const afterSeqRaw = req.query.after_seq;
    const afterSeq = typeof afterSeqRaw === 'string' ? Number.parseInt(afterSeqRaw, 10) || 0 : 0;

    if (access.chatParticipantId) {
      entitlementHandshake = await ChatSseEntitlementHandshake.prepare({
        participantId: access.chatParticipantId,
        deliver: payload => writeProtectedPayload(res, payload),
        onRevoked: () => {
          clientClosed = true;
          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = undefined;
          }
          if (res.headersSent && !res.writableEnded) res.end();
        },
        validateDurableScope: async participantId => {
          const durableAccess = await assertAIStreamScopeAccess(
            scopeTypeParam,
            req.params.scopeId,
            actor,
          );
          return durableAccess.chatParticipantId === participantId;
        },
        signal: setupAbortController.signal,
      });
      if (transportClosed || res.destroyed) {
        entitlementHandshake.dispose();
        return;
      }
      const subscriptionCleanup = await aiStreamService.subscribe(
        scopeTypeParam,
        req.params.scopeId,
        event => {
          if (clientClosed || res.writableEnded || res.destroyed) return;
          void entitlementHandshake?.push({ kind: 'event', event });
        },
        { afterSeq, notBefore: access.replayNotBefore },
      );
      entitlementHandshake.bindSubscription(subscriptionCleanup);
      if (transportClosed || res.destroyed) {
        entitlementHandshake.dispose();
        return;
      }
      if (entitlementHandshake.isClosed()) {
        throw Errors.FORBIDDEN('聊天室參與者權限已失效');
      }
      const snapshots = await aiStreamService.getSnapshots(
        scopeTypeParam,
        req.params.scopeId,
        { notBefore: access.replayNotBefore },
      );
      if (transportClosed || res.destroyed) {
        entitlementHandshake.dispose();
        return;
      }
      await entitlementHandshake.confirmBeforeHeaders();
      if (transportClosed || res.destroyed) {
        entitlementHandshake.dispose();
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      const snapshotLastSeqByStreamId = new Map(
        snapshots.map(snapshot => [snapshot.streamId, snapshot.lastSeq]),
      );
      await entitlementHandshake.activateWithInitialAndFlush(
        {
          kind: 'ready',
          scopeType: scopeTypeParam,
          scopeId: req.params.scopeId,
          snapshots,
        },
        payload => (
          payload.kind === 'event'
          && (snapshotLastSeqByStreamId.get(payload.event.streamId) ?? -1) >= payload.event.seq
        ),
      );
      if (entitlementHandshake.isClosed()) return;
    } else {
      const bufferedEvents: AIStreamEvent[] = [];
      let headersReady = false;
      const subscriptionCleanup = await aiStreamService.subscribe(
        scopeTypeParam,
        req.params.scopeId,
        event => {
          if (clientClosed || res.writableEnded || res.destroyed) return;
          if (!headersReady) {
            bufferedEvents.push(event);
            return;
          }
          res.write(`event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
        },
        { afterSeq, notBefore: access.replayNotBefore },
      );
      if (transportClosed || res.destroyed) {
        subscriptionCleanup();
        return;
      }
      let subscriptionClosed = false;
      unsubscribe = () => {
        if (subscriptionClosed) return;
        subscriptionClosed = true;
        subscriptionCleanup();
      };
      const snapshots = await aiStreamService.getSnapshots(
        scopeTypeParam,
        req.params.scopeId,
        { notBefore: access.replayNotBefore },
      );
      if (transportClosed || res.destroyed) {
        return;
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
    }

    if (!clientClosed) {
      heartbeat = setInterval(() => {
        if (clientClosed || res.writableEnded || res.destroyed) return;
        void aiStreamService.emitScopeHeartbeat(scopeTypeParam, req.params.scopeId);
      }, 15000);
    }

  } catch (error) {
    releaseResources();
    if (transportClosed || res.destroyed) return;
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    next(error);
  }
});

export default router;
