import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PipelineStep } from '../../../src/types/interview.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  interviewSession: { update: jest.fn() },
};
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));

import { runPipelineStepWithRetry } from '../../../src/services/async-pipeline-step-runner';

describe('runPipelineStepWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.interviewSession.update.mockResolvedValue({});
  });

  it('step 首次成功時應更新 pipeline_step 並返回 true', async () => {
    const run = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const sleepMs = jest.fn<() => Promise<void>>();

    await expect(
      runPipelineStepWithRetry({
        sessionId: 'session-1',
        step: PipelineStep.NARRATIVE_EXTRACTION,
        run,
        skippable: false,
        sleepMs,
      })
    ).resolves.toBe(true);

    expect(run).toHaveBeenCalledTimes(1);
    expect(sleepMs).not.toHaveBeenCalled();
    expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { pipeline_step: PipelineStep.NARRATIVE_EXTRACTION },
    });
  });

  it('step 暫時失敗後成功時應等待後重試，且只在成功後推進 pipeline_step', async () => {
    const run = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(undefined);
    const sleepMs = jest.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      runPipelineStepWithRetry({
        sessionId: 'session-1',
        step: PipelineStep.INSIGHT_EXTRACTION,
        run,
        skippable: true,
        sleepMs,
      })
    ).resolves.toBe(true);

    expect(run).toHaveBeenCalledTimes(2);
    expect(sleepMs).toHaveBeenCalledWith(2000);
    expect(prismaMock.interviewSession.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { pipeline_step: PipelineStep.INSIGHT_EXTRACTION },
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Pipeline step failed',
      expect.objectContaining({
        sessionId: 'session-1',
        step: PipelineStep.INSIGHT_EXTRACTION,
        attempt: 1,
        error: 'temporary failure',
      })
    );
  });

  it('skippable step 全部重試失敗時應標記該 step 已處理並返回 false', async () => {
    const run = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('optional step down'));
    const sleepMs = jest.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      runPipelineStepWithRetry({
        sessionId: 'session-1',
        step: PipelineStep.FEEDBACK_GENERATION,
        run,
        skippable: true,
        sleepMs,
      })
    ).resolves.toBe(false);

    expect(run).toHaveBeenCalledTimes(3);
    expect(sleepMs).toHaveBeenNthCalledWith(1, 2000);
    expect(sleepMs).toHaveBeenNthCalledWith(2, 4000);
    expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { pipeline_step: PipelineStep.FEEDBACK_GENERATION },
    });
    expect(loggerMock.warn).toHaveBeenCalledWith('Pipeline step skipped after retries', {
      sessionId: 'session-1',
      step: PipelineStep.FEEDBACK_GENERATION,
    });
  });

  it('non-skippable step 全部重試失敗時應拋 PROCESSING_FAILED 且不推進 pipeline_step', async () => {
    const run = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('required step down'));
    const sleepMs = jest.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      runPipelineStepWithRetry({
        sessionId: 'session-1',
        step: PipelineStep.RICHNESS_CALCULATION,
        run,
        skippable: false,
        sleepMs,
      })
    ).rejects.toMatchObject({
      code: 'PROCESSING_FAILED',
      message: expect.stringContaining('Pipeline step 4 failed after 3 attempts'),
    });

    expect(run).toHaveBeenCalledTimes(3);
    expect(sleepMs).toHaveBeenNthCalledWith(1, 2000);
    expect(sleepMs).toHaveBeenNthCalledWith(2, 4000);
    expect(prismaMock.interviewSession.update).not.toHaveBeenCalled();
  });
});
