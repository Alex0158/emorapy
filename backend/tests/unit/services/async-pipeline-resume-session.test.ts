import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock: any = {
  interviewSession: { findUnique: jest.fn(), update: jest.fn() },
};

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { prepareAsyncPipelineResumeSession } from '../../../src/services/async-pipeline-resume-session';

describe('prepareAsyncPipelineResumeSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.interviewSession.update.mockResolvedValue({});
  });

  it('session 不存在時應拋 VALIDATION_ERROR 且不更新', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue(null);

    await expect(prepareAsyncPipelineResumeSession('session-1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('僅可重試處理失敗的訪談'),
    });

    expect(prismaMock.interviewSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
    expect(prismaMock.interviewSession.update).not.toHaveBeenCalled();
  });

  it('session 狀態不允許 resume 時應拋 VALIDATION_ERROR 且不更新', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      status: INTERVIEW_STATUS.IN_PROGRESS,
    });

    await expect(prepareAsyncPipelineResumeSession('session-1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('僅可重試處理失敗的訪談'),
    });

    expect(prismaMock.interviewSession.update).not.toHaveBeenCalled();
  });

  it('PROCESSING 狀態應直接返回 userId 且不重複更新狀態', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      status: INTERVIEW_STATUS.PROCESSING,
    });

    await expect(prepareAsyncPipelineResumeSession('session-1')).resolves.toEqual({
      userId: 'user-1',
    });

    expect(prismaMock.interviewSession.update).not.toHaveBeenCalled();
  });

  it('PROCESSING_FAILED 狀態應先恢復為 PROCESSING 再返回 userId', async () => {
    prismaMock.interviewSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      status: INTERVIEW_STATUS.PROCESSING_FAILED,
    });

    await expect(prepareAsyncPipelineResumeSession('session-1')).resolves.toEqual({
      userId: 'user-1',
    });

    expect(prismaMock.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: INTERVIEW_STATUS.PROCESSING },
    });
  });

  it('PROCESSING_FAILED 狀態恢復失敗時應向上拋出且不吞錯', async () => {
    const error = new Error('db unavailable');
    prismaMock.interviewSession.findUnique.mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      status: INTERVIEW_STATUS.PROCESSING_FAILED,
    });
    prismaMock.interviewSession.update.mockRejectedValue(error);

    await expect(prepareAsyncPipelineResumeSession('session-1')).rejects.toBe(error);
  });
});
