import prisma from '../config/database';
import { INTERVIEW_STATUS } from '../utils/constants';
import { Errors } from '../utils/errors';
import {
  PIPELINE_RESUME_VALIDATION_MESSAGE,
  getNextPipelineResumeStep,
  isUserRetryablePipelineStatus,
} from './async-pipeline-resume-policy';

export interface PreparedInterviewProcessingRetry {
  sessionId: string;
  fromStep: number;
}

export { getNextPipelineResumeStep as getInterviewProcessingResumeStep } from './async-pipeline-resume-policy';

export async function prepareInterviewProcessingRetry(
  sessionId: string,
  userId: string
): Promise<PreparedInterviewProcessingRetry> {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, user_id: userId },
    select: { id: true, status: true, pipeline_step: true },
  });

  if (!session) {
    throw Errors.NOT_FOUND('訪談不存在或無權限');
  }
  if (!isUserRetryablePipelineStatus(session.status)) {
    throw Errors.VALIDATION_ERROR(PIPELINE_RESUME_VALIDATION_MESSAGE);
  }

  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: INTERVIEW_STATUS.PROCESSING },
  });

  return {
    sessionId,
    fromStep: getNextPipelineResumeStep(session.pipeline_step),
  };
}
