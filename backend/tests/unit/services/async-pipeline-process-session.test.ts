import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

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

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: loggerMock,
}));

import { prepareAsyncPipelineProcessSession } from '../../../src/services/async-pipeline-process-session';

describe('prepareAsyncPipelineProcessSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('session 不存在時應返回 null 並記錄 warning', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue(null);

    await expect(prepareAsyncPipelineProcessSession('session-1')).resolves.toBeNull();

    expect(prismaMock.interviewSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Pipeline process: session not found or not in processing',
      { sessionId: 'session-1' }
    );
  });

  it('session 狀態不是 PROCESSING 時應返回 null 並記錄 warning', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      status: INTERVIEW_STATUS.COMPLETED,
    });

    await expect(prepareAsyncPipelineProcessSession('session-1')).resolves.toBeNull();

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'Pipeline process: session not found or not in processing',
      { sessionId: 'session-1' }
    );
  });

  it('session 狀態為 PROCESSING 時應返回 userId', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      status: INTERVIEW_STATUS.PROCESSING,
    });

    await expect(prepareAsyncPipelineProcessSession('session-1')).resolves.toEqual({
      userId: 'user-1',
    });

    expect(loggerMock.warn).not.toHaveBeenCalled();
  });
});
