import prisma from '../config/database';
import { INTERVIEW_STATUS } from '../utils/constants';
import { USER_RETRYABLE_PIPELINE_STATUSES } from './async-pipeline-resume-policy';
import type { InterviewResumeStatus } from '@emorapy/contracts/interview';

export async function loadInterviewResumeStatus(userId: string): Promise<InterviewResumeStatus> {
  const [inProgress, failed] = await Promise.all([
    prisma.interviewSession.findFirst({
      where: { user_id: userId, status: INTERVIEW_STATUS.IN_PROGRESS },
      select: {
        id: true,
        turns: {
          select: { ai_message: true },
          orderBy: { turn_order: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.interviewSession.findFirst({
      where: { user_id: userId, status: { in: [...USER_RETRYABLE_PIPELINE_STATUSES] } },
      select: { id: true },
      orderBy: { updated_at: 'desc' },
    }),
  ]);

  const result: InterviewResumeStatus = { has_pending: false };

  if (inProgress) {
    const lastTurn = inProgress.turns[0];
    const turnCount = await prisma.interviewTurn.count({
      where: { session_id: inProgress.id },
    });
    result.has_pending = true;
    result.session_id = inProgress.id;
    result.last_ai_message = lastTurn?.ai_message ?? null;
    result.turn_count = turnCount;
  }

  if (failed) {
    result.has_failed = true;
    result.failed_session_id = failed.id;
  }

  return result;
}
