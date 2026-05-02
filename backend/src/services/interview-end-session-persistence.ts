import prisma from '../config/database';
import { CLEANUP_THRESHOLDS, INTERVIEW_STATUS } from '../utils/constants';
import { Errors } from '../utils/errors';
import type { Prisma } from '../types/prisma-client';
import {
  buildInterviewEndSessionDisposition,
  type InterviewEndSessionDisposition,
} from './interview-end-session-utils';

type InterviewEndSessionSession = Prisma.InterviewSessionGetPayload<{
  include: {
    turns: { select: { user_response: true } };
    _count: { select: { turns: true } };
  };
}>;

export interface PersistInterviewEndSessionParams {
  sessionId: string;
  userId: string;
  endedAt?: Date;
}

export async function persistInterviewEndSession({
  sessionId,
  userId,
  endedAt = new Date(),
}: PersistInterviewEndSessionParams): Promise<InterviewEndSessionDisposition> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      turns: { select: { user_response: true } },
      _count: { select: { turns: true } },
    },
  }) as InterviewEndSessionSession | null;

  if (!session || session.user_id !== userId) {
    throw Errors.NOT_FOUND('訪談不存在或無權限');
  }
  if (session.status !== INTERVIEW_STATUS.IN_PROGRESS) {
    throw Errors.SESSION_COMPLETED();
  }

  const disposition = buildInterviewEndSessionDisposition({
    turns: session.turns,
    turnCount: session._count.turns,
    minTurnsForPipeline: CLEANUP_THRESHOLDS.MIN_TURNS_FOR_PIPELINE,
    minUserContentChars: CLEANUP_THRESHOLDS.MIN_USER_CONTENT_CHARS,
  });

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: disposition.status, ended_at: endedAt },
  });

  return disposition;
}
