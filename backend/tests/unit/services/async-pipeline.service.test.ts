/**
 * AsyncPipelineService 單元測試（mock public wiring helpers）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PipelineStep } from '../../../src/types/interview.types';

const mockPrepareProcessSession = jest.fn<(sessionId: string) => Promise<{ userId: string } | null>>();
const mockRunWithProcessLock = jest.fn<
  (options: { sessionId: string; run: () => Promise<void> }) => Promise<boolean>
>();
const mockPrepareResumeSession = jest.fn<(sessionId: string) => Promise<{ userId: string }>>();
const mockWithLock = jest.fn<(key: string, fn: () => Promise<void>, ttlSeconds: number) => Promise<void>>();
const mockRunAsyncPipeline = jest.fn<
  (options: { sessionId: string; userId: string; fromStep: number }) => Promise<void>
>();

jest.mock('../../../src/services/async-pipeline-process-session', () => ({
  prepareAsyncPipelineProcessSession: (sessionId: string) => mockPrepareProcessSession(sessionId),
}));
jest.mock('../../../src/services/async-pipeline-process-lock', () => ({
  runWithAsyncPipelineProcessLock: (options: { sessionId: string; run: () => Promise<void> }) =>
    mockRunWithProcessLock(options),
}));
jest.mock('../../../src/services/async-pipeline-resume-session', () => ({
  prepareAsyncPipelineResumeSession: (sessionId: string) => mockPrepareResumeSession(sessionId),
}));
jest.mock('../../../src/utils/lock', () => ({
  lockService: {
    withLock: (key: string, fn: () => Promise<void>, ttlSeconds: number) =>
      mockWithLock(key, fn, ttlSeconds),
  },
}));
jest.mock('../../../src/services/async-pipeline-runner', () => ({
  runAsyncPipeline: (options: { sessionId: string; userId: string; fromStep: number }) =>
    mockRunAsyncPipeline(options),
}));

import { AsyncPipelineService } from '../../../src/services/async-pipeline.service';

describe('AsyncPipelineService', () => {
  let service: AsyncPipelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRunWithProcessLock.mockResolvedValue(true);
    mockWithLock.mockResolvedValue(undefined);
    mockRunAsyncPipeline.mockResolvedValue(undefined);
    service = new AsyncPipelineService();
  });

  describe('process', () => {
    it('process session gate 返回 null 時應正常返回且不進 lock 或 runner', async () => {
      mockPrepareProcessSession.mockResolvedValue(null);

      await service.process('session-1');

      expect(mockPrepareProcessSession).toHaveBeenCalledWith('session-1');
      expect(mockRunWithProcessLock).not.toHaveBeenCalled();
      expect(mockRunAsyncPipeline).not.toHaveBeenCalled();
    });

    it('process session gate 通過時應把 NOT_STARTED runner 包進 process lock', async () => {
      mockPrepareProcessSession.mockResolvedValue({ userId: 'user-1' });

      await service.process('session-1');

      expect(mockRunWithProcessLock).toHaveBeenCalledWith({
        sessionId: 'session-1',
        run: expect.any(Function),
      });

      const [{ run }] = mockRunWithProcessLock.mock.calls[0];
      await run();

      expect(mockRunAsyncPipeline).toHaveBeenCalledWith({
        sessionId: 'session-1',
        userId: 'user-1',
        fromStep: PipelineStep.NOT_STARTED,
      });
    });
  });

  describe('resume', () => {
    it('resume session gate 拋錯時應向上拋出且不進 lock 或 runner', async () => {
      const error = Object.assign(new Error('僅可重試處理失敗的訪談'), {
        code: 'VALIDATION_ERROR',
      });
      mockPrepareResumeSession.mockRejectedValue(error);

      await expect(service.resume('session-1', 0)).rejects.toBe(error);

      expect(mockPrepareResumeSession).toHaveBeenCalledWith('session-1');
      expect(mockWithLock).not.toHaveBeenCalled();
      expect(mockRunAsyncPipeline).not.toHaveBeenCalled();
    });

    it('resume session gate 通過時應用強制 lock 包住指定 fromStep runner', async () => {
      mockPrepareResumeSession.mockResolvedValue({ userId: 'user-1' });

      await service.resume('session-1', PipelineStep.NARRATIVE_SUMMARY);

      expect(mockPrepareResumeSession).toHaveBeenCalledWith('session-1');
      expect(mockWithLock).toHaveBeenCalledWith(
        'pipeline:session:session-1',
        expect.any(Function),
        300
      );

      const [, run] = mockWithLock.mock.calls[0];
      await run();

      expect(mockRunAsyncPipeline).toHaveBeenCalledWith({
        sessionId: 'session-1',
        userId: 'user-1',
        fromStep: PipelineStep.NARRATIVE_SUMMARY,
      });
    });
  });
});
