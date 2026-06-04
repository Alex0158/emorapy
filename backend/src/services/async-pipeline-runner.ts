import prisma from '../config/database';
import logger from '../config/logger';
import { PipelineStep } from '../types/interview.types';
import { Errors } from '../utils/errors';
import type { BackendLocale } from '../i18n';
import { runPipelineStepWithRetry } from './async-pipeline-step-runner';
import { buildAsyncPipelineSteps } from './async-pipeline-steps';
import { markPipelineCompleted, markPipelineProcessingFailed } from './async-pipeline-session-status';

export interface RunAsyncPipelineOptions {
  sessionId: string;
  userId: string;
  fromStep: number;
  locale?: BackendLocale;
}

export async function runAsyncPipeline({
  sessionId,
  userId,
  fromStep,
  locale,
}: RunAsyncPipelineOptions): Promise<void> {
  const steps = buildAsyncPipelineSteps({ sessionId, userId, locale });
  const skippedSteps: PipelineStep[] = [];

  try {
    for (const { step, run, skippable } of steps) {
      if (step < fromStep) continue;
      const exists = await prisma.interviewSession.findUnique({ where: { id: sessionId }, select: { id: true } });
      if (!exists) {
        logger.info('Pipeline aborted: session deleted mid-pipeline', { sessionId });
        return;
      }
      const success = await runPipelineStepWithRetry({ sessionId, step, run, skippable });
      if (!success) {
        skippedSteps.push(step);
      }
    }

    await markPipelineCompleted(sessionId);
    if (skippedSteps.length > 0) {
      logger.warn('Pipeline completed with skipped steps', { sessionId, skippedSteps });
    }
    logger.info('Pipeline completed', { sessionId });
  } catch (err) {
    logger.error('Pipeline failed (non-skippable step)', {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    await markPipelineProcessingFailed(sessionId);
    throw Errors.PROCESSING_FAILED(err instanceof Error ? err.message : String(err));
  }
}
