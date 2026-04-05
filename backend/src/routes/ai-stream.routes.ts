import { Router } from 'express';
import type { AIStreamScopeType } from '../types/ai-stream';
import { optionalAuthenticate } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { Errors } from '../utils/errors';
import { getAuthUserIdOptional, getSessionIdFromSources } from '../utils/request';
import { chatService } from '../services/chat.service';
import { interviewService } from '../services/interview.service';
import { caseService } from '../services/case.service';
import { aiStreamService } from '../services/ai-stream.service';
import { executionService } from '../services/execution.service';

const router = Router();

function isAIStreamScopeType(value: string): value is AIStreamScopeType {
  return ['interview_session', 'chat_room', 'case_judgment', 'judgment_detail', 'repair_track', 'generic_ai_task'].includes(value);
}

async function assertScopeAccess(scopeType: AIStreamScopeType, scopeId: string, userId?: string, sessionId?: string) {
  switch (scopeType) {
    case 'interview_session':
      if (!userId) throw Errors.UNAUTHORIZED('需要認證');
      await interviewService.getSession(scopeId, userId);
      return;
    case 'chat_room':
      await chatService.getRoom(scopeId, { userId, sessionId });
      return;
    case 'case_judgment':
    case 'judgment_detail':
      await caseService.getCaseById(scopeId, userId, sessionId);
      return;
    case 'repair_track':
      if (!userId) throw Errors.UNAUTHORIZED('需要認證');
      await executionService.assertTrackAccess(scopeId, userId);
      return;
    case 'generic_ai_task':
      return;
  }
}

router.get('/:scopeType/:scopeId', generalLimiter, optionalAuthenticate, async (req, res, next) => {
  try {
    const scopeTypeParam = req.params.scopeType;
    if (!isAIStreamScopeType(scopeTypeParam)) {
      throw Errors.VALIDATION_ERROR('未知的 AI stream scopeType');
    }

    const userId = getAuthUserIdOptional(req);
    const { sessionId, hasConflict } = getSessionIdFromSources(req);
    if (hasConflict) {
      throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
    }

    await assertScopeAccess(scopeTypeParam, req.params.scopeId, userId, sessionId ?? undefined);

    const afterSeqRaw = req.query.after_seq;
    const afterSeq = typeof afterSeqRaw === 'string' ? Number.parseInt(afterSeqRaw, 10) || 0 : 0;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let clientClosed = false;
    const unsubscribe = await aiStreamService.subscribe(
      scopeTypeParam,
      req.params.scopeId,
      (event) => {
        if (clientClosed || res.writableEnded || res.destroyed) return;
        res.write(`event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      },
      { afterSeq }
    );

    if (!clientClosed && !res.writableEnded && !res.destroyed) {
      res.write(`event: ready\ndata: ${JSON.stringify({
        scopeType: scopeTypeParam,
        scopeId: req.params.scopeId,
        snapshots: await aiStreamService.getSnapshots(scopeTypeParam, req.params.scopeId),
      })}\n\n`);
    }

    const heartbeat = setInterval(() => {
      if (clientClosed || res.writableEnded || res.destroyed) return;
      void aiStreamService.emitScopeHeartbeat(scopeTypeParam, req.params.scopeId);
    }, 15000);

    req.on('close', () => {
      clientClosed = true;
      clearInterval(heartbeat);
      unsubscribe();
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
