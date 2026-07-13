import type { Request } from 'express';
import type { ChatActorContext } from '../services/chat-actor-access.service';
import { Errors } from '../utils/errors';
import { getAuthUserIdOptional, getSessionIdFromSources } from '../utils/request';

export function getChatActorFromRequest(req: Request): ChatActorContext {
  const userId = getAuthUserIdOptional(req);
  const sessionContext = getSessionIdFromSources(req);
  if (sessionContext.hasConflict) {
    throw Errors.INVALID_SESSION_ID('Header 與 Query 的 Session ID 不一致');
  }

  return {
    userId,
    sessionId: sessionContext.sessionId,
  };
}
