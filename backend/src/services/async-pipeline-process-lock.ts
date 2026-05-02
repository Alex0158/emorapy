import logger from '../config/logger';
import { lockService } from '../utils/lock';

const PIPELINE_PROCESS_LOCK_TTL_SECONDS = 300;

export interface RunWithAsyncPipelineProcessLockOptions {
  sessionId: string;
  run: () => Promise<void>;
}

export async function runWithAsyncPipelineProcessLock({
  sessionId,
  run,
}: RunWithAsyncPipelineProcessLockOptions): Promise<boolean> {
  const lockKey = `pipeline:session:${sessionId}`;
  const acquired = await lockService.acquire(lockKey, PIPELINE_PROCESS_LOCK_TTL_SECONDS);
  if (!acquired) {
    logger.info('Pipeline already running, skipping duplicate', { sessionId });
    return false;
  }

  try {
    await run();
    return true;
  } finally {
    await lockService.release(lockKey);
  }
}
