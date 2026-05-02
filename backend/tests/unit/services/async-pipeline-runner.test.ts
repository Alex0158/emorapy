import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PipelineStep } from '../../../src/types/interview.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  interviewSession: { findUnique: jest.fn() },
};
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockBuildAsyncPipelineSteps = jest.fn();
const mockRunPipelineStepWithRetry = jest.fn<
  (options: {
    sessionId: string;
    step: PipelineStep;
    run: () => Promise<void>;
    skippable: boolean;
  }) => Promise<boolean>
>();
const mockMarkPipelineCompleted = jest.fn<(sessionId: string) => Promise<void>>();
const mockMarkPipelineProcessingFailed = jest.fn<(sessionId: string) => Promise<void>>();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));
jest.mock('../../../src/services/async-pipeline-steps', () => ({
  buildAsyncPipelineSteps: (options: { sessionId: string; userId: string }) =>
    mockBuildAsyncPipelineSteps(options),
}));
jest.mock('../../../src/services/async-pipeline-step-runner', () => ({
  runPipelineStepWithRetry: (options: {
    sessionId: string;
    step: PipelineStep;
    run: () => Promise<void>;
    skippable: boolean;
  }) => mockRunPipelineStepWithRetry(options),
}));
jest.mock('../../../src/services/async-pipeline-session-status', () => ({
  markPipelineCompleted: (sessionId: string) => mockMarkPipelineCompleted(sessionId),
  markPipelineProcessingFailed: (sessionId: string) => mockMarkPipelineProcessingFailed(sessionId),
}));

import { runAsyncPipeline } from '../../../src/services/async-pipeline-runner';

describe('runAsyncPipeline', () => {
  const runNarrativeExtraction = jest.fn<() => Promise<void>>();
  const runNarrativeSummary = jest.fn<() => Promise<void>>();
  const runInsightExtraction = jest.fn<() => Promise<void>>();

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.interviewSession.findUnique.mockResolvedValue({ id: 'session-1' });
    mockRunPipelineStepWithRetry.mockResolvedValue(true);
    mockMarkPipelineCompleted.mockResolvedValue(undefined);
    mockMarkPipelineProcessingFailed.mockResolvedValue(undefined);
    mockBuildAsyncPipelineSteps.mockReturnValue([
      {
        step: PipelineStep.NARRATIVE_EXTRACTION,
        run: runNarrativeExtraction,
        skippable: false,
      },
      {
        step: PipelineStep.NARRATIVE_SUMMARY,
        run: runNarrativeSummary,
        skippable: true,
      },
      {
        step: PipelineStep.INSIGHT_EXTRACTION,
        run: runInsightExtraction,
        skippable: true,
      },
    ]);
  });

  it('應從 fromStep 開始執行，跳過更早 step，完成後標記 completed', async () => {
    await runAsyncPipeline({
      sessionId: 'session-1',
      userId: 'user-1',
      fromStep: PipelineStep.NARRATIVE_SUMMARY,
    });

    expect(mockBuildAsyncPipelineSteps).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
    });
    expect(mockRunPipelineStepWithRetry).toHaveBeenCalledTimes(2);
    expect(mockRunPipelineStepWithRetry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sessionId: 'session-1',
        step: PipelineStep.NARRATIVE_SUMMARY,
        run: runNarrativeSummary,
        skippable: true,
      })
    );
    expect(mockRunPipelineStepWithRetry).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sessionId: 'session-1',
        step: PipelineStep.INSIGHT_EXTRACTION,
        run: runInsightExtraction,
        skippable: true,
      })
    );
    expect(prismaMock.interviewSession.findUnique).toHaveBeenCalledTimes(2);
    expect(prismaMock.interviewSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      select: { id: true },
    });
    expect(mockMarkPipelineCompleted).toHaveBeenCalledWith('session-1');
    expect(loggerMock.info).toHaveBeenCalledWith('Pipeline completed', { sessionId: 'session-1' });
  });

  it('step 執行前發現 session 已刪除時應中止，不標記 completed 或 failed', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue(null);

    await runAsyncPipeline({
      sessionId: 'session-1',
      userId: 'user-1',
      fromStep: PipelineStep.NARRATIVE_EXTRACTION,
    });

    expect(mockRunPipelineStepWithRetry).not.toHaveBeenCalled();
    expect(mockMarkPipelineCompleted).not.toHaveBeenCalled();
    expect(mockMarkPipelineProcessingFailed).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith('Pipeline aborted: session deleted mid-pipeline', {
      sessionId: 'session-1',
    });
  });

  it('skippable step 失敗後應收集 skippedSteps 並在 completed 後記錄 warning', async () => {
    mockRunPipelineStepWithRetry.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockBuildAsyncPipelineSteps.mockReturnValue([
      {
        step: PipelineStep.NARRATIVE_EXTRACTION,
        run: runNarrativeExtraction,
        skippable: false,
      },
      {
        step: PipelineStep.NARRATIVE_SUMMARY,
        run: runNarrativeSummary,
        skippable: true,
      },
    ]);

    await runAsyncPipeline({
      sessionId: 'session-1',
      userId: 'user-1',
      fromStep: PipelineStep.NARRATIVE_EXTRACTION,
    });

    expect(mockMarkPipelineCompleted).toHaveBeenCalledWith('session-1');
    expect(loggerMock.warn).toHaveBeenCalledWith('Pipeline completed with skipped steps', {
      sessionId: 'session-1',
      skippedSteps: [PipelineStep.NARRATIVE_SUMMARY],
    });
  });

  it('step runner 拋錯時應標記 processing_failed 並拋 PROCESSING_FAILED', async () => {
    mockRunPipelineStepWithRetry.mockRejectedValue(new Error('required step down'));

    await expect(
      runAsyncPipeline({
        sessionId: 'session-1',
        userId: 'user-1',
        fromStep: PipelineStep.NARRATIVE_EXTRACTION,
      })
    ).rejects.toMatchObject({
      code: 'PROCESSING_FAILED',
      message: 'required step down',
    });

    expect(mockMarkPipelineCompleted).not.toHaveBeenCalled();
    expect(mockMarkPipelineProcessingFailed).toHaveBeenCalledWith('session-1');
    expect(loggerMock.error).toHaveBeenCalledWith('Pipeline failed (non-skippable step)', {
      sessionId: 'session-1',
      error: 'required step down',
    });
  });

  it('failure status 更新失敗時應向上拋出該錯誤', async () => {
    const failureStatusError = new Error('failed to mark failure');
    mockRunPipelineStepWithRetry.mockRejectedValue(new Error('step failed'));
    mockMarkPipelineProcessingFailed.mockRejectedValue(failureStatusError);

    await expect(
      runAsyncPipeline({
        sessionId: 'session-1',
        userId: 'user-1',
        fromStep: PipelineStep.NARRATIVE_EXTRACTION,
      })
    ).rejects.toBe(failureStatusError);
  });
});
