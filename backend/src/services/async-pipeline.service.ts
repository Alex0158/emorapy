import { PipelineStep } from '../types/interview.types';
import type { BackendLocale } from '../i18n';
import { lockService } from '../utils/lock';
import { prepareAsyncPipelineResumeSession } from './async-pipeline-resume-session';
import { prepareAsyncPipelineProcessSession } from './async-pipeline-process-session';
import { runWithAsyncPipelineProcessLock } from './async-pipeline-process-lock';
import { runAsyncPipeline } from './async-pipeline-runner';

export class AsyncPipelineService {
  /**
   * 從頭執行管道（fire-and-forget 場景；若已有管道在跑則靜默返回）
   */
  async process(sessionId: string, options: { locale?: BackendLocale } = {}): Promise<void> {
    const session = await prepareAsyncPipelineProcessSession(sessionId);
    if (!session) {
      return;
    }

    await runWithAsyncPipelineProcessLock({
      sessionId,
      run: () => runAsyncPipeline({
        sessionId,
        userId: session.userId,
        fromStep: PipelineStep.NOT_STARTED,
        locale: options.locale,
      }),
    });
  }

  /**
   * 從指定步驟繼續執行（用於 retry failed；若已有管道在跑則拋 CONFLICT）
   */
  async resume(sessionId: string, fromStep: number, options: { locale?: BackendLocale } = {}): Promise<void> {
    const { userId } = await prepareAsyncPipelineResumeSession(sessionId);
    await lockService.withLock(
      `pipeline:session:${sessionId}`,
      () => runAsyncPipeline({ sessionId, userId, fromStep, locale: options.locale }),
      300
    );
  }
}

export const asyncPipelineService = new AsyncPipelineService();
