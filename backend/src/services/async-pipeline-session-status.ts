import prisma from '../config/database';
import logger from '../config/logger';
import { PipelineStep } from '../types/interview.types';
import { INTERVIEW_STATUS } from '../utils/constants';

interface PipelineSessionStatusUpdateOptions {
  sessionId: string;
  deletedSessionLogMessage: string;
  update: () => Promise<unknown>;
}

function isPrismaRecordNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2025';
}

async function applyPipelineSessionStatusUpdate({
  sessionId,
  deletedSessionLogMessage,
  update,
}: PipelineSessionStatusUpdateOptions): Promise<void> {
  try {
    await update();
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      logger.info(deletedSessionLogMessage, { sessionId });
      return;
    }
    throw error;
  }
}

export async function markPipelineCompleted(sessionId: string): Promise<void> {
  await applyPipelineSessionStatusUpdate({
    sessionId,
    deletedSessionLogMessage: 'Pipeline completion skipped: session deleted',
    update: () =>
      prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: INTERVIEW_STATUS.COMPLETED, pipeline_step: PipelineStep.COMPLETED },
      }),
  });
}

export async function markPipelineProcessingFailed(sessionId: string): Promise<void> {
  await applyPipelineSessionStatusUpdate({
    sessionId,
    deletedSessionLogMessage: 'Pipeline failure status skipped: session deleted',
    update: () =>
      prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: INTERVIEW_STATUS.PROCESSING_FAILED },
      }),
  });
}
