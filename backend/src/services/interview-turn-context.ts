import prisma from '../config/database';
import { INTERVIEW_STATUS } from '../utils/constants';
import { Errors } from '../utils/errors';
import {
  loadRuntimeInterviewConfig,
  type RuntimeInterviewConfig,
} from './interview-runtime-config';

async function loadInterviewTurnSession(sessionId: string) {
  return prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: { turns: { orderBy: { turn_order: 'asc' } } },
  });
}

export type InterviewTurnSession = NonNullable<
  Awaited<ReturnType<typeof loadInterviewTurnSession>>
>;

export interface ValidatedInterviewTurnContext {
  runtimeConfig: RuntimeInterviewConfig;
  session: InterviewTurnSession;
  lastTurn: InterviewTurnSession['turns'][number];
}

export async function loadValidatedInterviewTurnContext(
  sessionId: string,
  userId: string
): Promise<ValidatedInterviewTurnContext> {
  const runtimeConfig = await loadRuntimeInterviewConfig();
  const session = await loadInterviewTurnSession(sessionId);

  if (!session || session.user_id !== userId) {
    throw Errors.NOT_FOUND('訪談不存在或無權限');
  }
  if (session.status !== INTERVIEW_STATUS.IN_PROGRESS) {
    throw Errors.SESSION_COMPLETED();
  }
  if (session.turns.length >= runtimeConfig.maxTurns) {
    throw Errors.MAX_TURNS_REACHED();
  }

  const lastTurn = session.turns[session.turns.length - 1];
  if (!lastTurn) {
    throw Errors.INTERNAL_ERROR('訪談缺少可回覆輪次');
  }
  if (lastTurn.created_at) {
    const elapsed = Date.now() - lastTurn.created_at.getTime();
    if (elapsed < runtimeConfig.turnIntervalMs) {
      throw Errors.TURN_TOO_FAST();
    }
  }

  return { runtimeConfig, session, lastTurn };
}
