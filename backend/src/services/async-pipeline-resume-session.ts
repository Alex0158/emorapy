import prisma from '../config/database';
import { INTERVIEW_STATUS } from '../utils/constants';
import { Errors } from '../utils/errors';
import {
  PIPELINE_RESUME_VALIDATION_MESSAGE,
  isInternalPipelineResumeStatus,
} from './async-pipeline-resume-policy';

export interface PreparedAsyncPipelineResumeSession {
  userId: string;
}

export async function prepareAsyncPipelineResumeSession(
  sessionId: string
): Promise<PreparedAsyncPipelineResumeSession> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || !isInternalPipelineResumeStatus(session.status)) {
    throw Errors.VALIDATION_ERROR(PIPELINE_RESUME_VALIDATION_MESSAGE);
  }

  if (session.status === INTERVIEW_STATUS.PROCESSING_FAILED) {
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status: INTERVIEW_STATUS.PROCESSING },
    });
  }

  return { userId: session.user_id };
}
