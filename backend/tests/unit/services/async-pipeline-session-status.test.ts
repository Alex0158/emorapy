import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PipelineStep } from '../../../src/types/interview.types';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

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

import {
  markPipelineCompleted,
  markPipelineProcessingFailed,
} from '../../../src/services/async-pipeline-session-status';

describe('async pipeline session status helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.interviewSession.update.mockResolvedValue({});
  });

  it('markPipelineCompleted 應標記 session completed 並推進 pipeline_step', async () => {
    await markPipelineCompleted('session-1');

    expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: INTERVIEW_STATUS.COMPLETED, pipeline_step: PipelineStep.COMPLETED },
    });
  });

  it('markPipelineProcessingFailed 應標記 session processing_failed', async () => {
    await markPipelineProcessingFailed('session-1');

    expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: INTERVIEW_STATUS.PROCESSING_FAILED },
    });
  });

  it('completion update 遇到 Prisma P2025 時應視為 session 已刪除並正常返回', async () => {
    prismaMock.interviewSession.update.mockRejectedValue(Object.assign(new Error('not found'), { code: 'P2025' }));

    await expect(markPipelineCompleted('session-1')).resolves.toBeUndefined();

    expect(loggerMock.info).toHaveBeenCalledWith('Pipeline completion skipped: session deleted', {
      sessionId: 'session-1',
    });
  });

  it('failure update 遇到 Prisma P2025 時應視為 session 已刪除並正常返回', async () => {
    prismaMock.interviewSession.update.mockRejectedValue(Object.assign(new Error('not found'), { code: 'P2025' }));

    await expect(markPipelineProcessingFailed('session-1')).resolves.toBeUndefined();

    expect(loggerMock.info).toHaveBeenCalledWith('Pipeline failure status skipped: session deleted', {
      sessionId: 'session-1',
    });
  });

  it('completion update 遇到非 P2025 錯誤時應向上拋出', async () => {
    const error = Object.assign(new Error('db unavailable'), { code: 'P1001' });
    prismaMock.interviewSession.update.mockRejectedValue(error);

    await expect(markPipelineCompleted('session-1')).rejects.toBe(error);
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  it('failure update 遇到非 P2025 錯誤時應向上拋出', async () => {
    const error = new Error('db unavailable');
    prismaMock.interviewSession.update.mockRejectedValue(error);

    await expect(markPipelineProcessingFailed('session-1')).rejects.toBe(error);
    expect(loggerMock.info).not.toHaveBeenCalled();
  });
});
