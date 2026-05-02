import { PsychDomain } from '@prisma/client';
import prisma from '../config/database';
import { INTERVIEW_AI_CONFIG } from '../config/openai';
import { INTERVIEW_STATUS } from '../utils/constants';
import type { Prisma } from '../types/prisma-client';
import type {
  InterviewStartTrigger,
  PreviousInterviewSessionDisposition,
} from './interview-start-session-utils';

export type PersistedInterviewStartSession = Prisma.InterviewSessionGetPayload<{
  include: { turns: true };
}>;

export interface PersistInterviewStartSessionParams {
  userId: string;
  trigger: InterviewStartTrigger;
  firstQuestion: string;
  previousSessionDisposition: PreviousInterviewSessionDisposition;
  startedAt?: Date;
}

export async function persistInterviewStartSession({
  userId,
  trigger,
  firstQuestion,
  previousSessionDisposition,
  startedAt = new Date(),
}: PersistInterviewStartSessionParams): Promise<PersistedInterviewStartSession | null> {
  return prisma.$transaction(async (tx) => {
    if (previousSessionDisposition) {
      await tx.interviewSession.update({
        where: { id: previousSessionDisposition.sessionId },
        data: { status: previousSessionDisposition.status },
      });
    }

    const session = await tx.interviewSession.create({
      data: {
        user_id: userId,
        trigger,
        status: INTERVIEW_STATUS.IN_PROGRESS,
        ai_model_used: INTERVIEW_AI_CONFIG.model,
        total_user_words: 0,
        total_ai_words: 0,
        started_at: startedAt,
      },
    });

    await tx.interviewTurn.create({
      data: {
        session_id: session.id,
        turn_order: 1,
        ai_message: firstQuestion,
        ai_intent: 'opening',
        ai_target_domains: [PsychDomain.personality],
      },
    });

    return tx.interviewSession.findUnique({
      where: { id: session.id },
      include: { turns: { orderBy: { turn_order: 'asc' } } },
    });
  });
}
