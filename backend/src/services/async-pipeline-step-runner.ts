import prisma from '../config/database';
import logger from '../config/logger';
import { PipelineStep } from '../types/interview.types';
import { Errors } from '../utils/errors';

export const PIPELINE_STEP_MAX_RETRIES = 2;
export const PIPELINE_STEP_RETRY_DELAYS_MS = [2000, 4000];

export type PipelineStepSleep = (ms: number) => Promise<void>;

export interface RunPipelineStepWithRetryOptions {
  sessionId: string;
  step: PipelineStep;
  run: () => Promise<void>;
  skippable: boolean;
  sleepMs?: PipelineStepSleep;
}

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runPipelineStepWithRetry({
  sessionId,
  step,
  run,
  skippable,
  sleepMs = defaultSleep,
}: RunPipelineStepWithRetryOptions): Promise<boolean> {
  for (let attempt = 0; attempt <= PIPELINE_STEP_MAX_RETRIES; attempt++) {
    try {
      await run();
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { pipeline_step: step },
      });
      return true;
    } catch (err) {
      logger.warn('Pipeline step failed', {
        sessionId,
        step,
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt < PIPELINE_STEP_MAX_RETRIES) {
        await sleepMs(PIPELINE_STEP_RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  if (skippable) {
    logger.warn('Pipeline step skipped after retries', { sessionId, step });
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { pipeline_step: step },
    });
    return false;
  }

  throw Errors.PROCESSING_FAILED(
    `Pipeline step ${step} failed after ${PIPELINE_STEP_MAX_RETRIES + 1} attempts`
  );
}
