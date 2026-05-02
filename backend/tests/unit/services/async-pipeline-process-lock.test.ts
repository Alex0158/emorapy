import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockAcquire = jest.fn<(key: string, ttlSeconds: number) => Promise<boolean>>();
const mockRelease = jest.fn<(key: string) => Promise<void>>();

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));
jest.mock('../../../src/utils/lock', () => ({
  lockService: {
    acquire: (key: string, ttlSeconds: number) => mockAcquire(key, ttlSeconds),
    release: (key: string) => mockRelease(key),
  },
}));

import { runWithAsyncPipelineProcessLock } from '../../../src/services/async-pipeline-process-lock';

describe('runWithAsyncPipelineProcessLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRelease.mockResolvedValue(undefined);
  });

  it('未取得 lock 時應返回 false，不執行 run，也不 release', async () => {
    const run = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockAcquire.mockResolvedValue(false);

    await expect(runWithAsyncPipelineProcessLock({ sessionId: 'session-1', run })).resolves.toBe(false);

    expect(mockAcquire).toHaveBeenCalledWith('pipeline:session:session-1', 300);
    expect(run).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith('Pipeline already running, skipping duplicate', {
      sessionId: 'session-1',
    });
  });

  it('取得 lock 時應執行 run，完成後 release 並返回 true', async () => {
    const run = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockAcquire.mockResolvedValue(true);

    await expect(runWithAsyncPipelineProcessLock({ sessionId: 'session-1', run })).resolves.toBe(true);

    expect(run).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledWith('pipeline:session:session-1');
    expect(run.mock.invocationCallOrder[0]).toBeLessThan(mockRelease.mock.invocationCallOrder[0]);
  });

  it('run 拋錯時仍應 release，且錯誤向上拋出', async () => {
    const error = new Error('pipeline failed');
    const run = jest.fn<() => Promise<void>>().mockRejectedValue(error);
    mockAcquire.mockResolvedValue(true);

    await expect(runWithAsyncPipelineProcessLock({ sessionId: 'session-1', run })).rejects.toBe(error);

    expect(mockRelease).toHaveBeenCalledWith('pipeline:session:session-1');
  });
});
