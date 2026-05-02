import prisma from '../config/database';
import logger from '../config/logger';
import { INTERVIEW_STATUS } from '../utils/constants';

export interface PreparedAsyncPipelineProcessSession {
  userId: string;
}

export async function prepareAsyncPipelineProcessSession(
  sessionId: string
): Promise<PreparedAsyncPipelineProcessSession | null> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.status !== INTERVIEW_STATUS.PROCESSING) {
    logger.warn('Pipeline process: session not found or not in processing', { sessionId });
    return null;
  }

  return { userId: session.user_id };
}
