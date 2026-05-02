import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PipelineStep } from '../../../src/types/interview.types';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    interviewSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from '../../../src/config/database';
import {
  getInterviewProcessingResumeStep,
  prepareInterviewProcessingRetry,
} from '../../../src/services/interview-processing-retry';

describe('interview-processing-retry', () => {
  const mockedPrisma = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getInterviewProcessingResumeStep 應保留既有 pipeline_step + 1 語義', () => {
    expect(getInterviewProcessingResumeStep(null)).toBe(PipelineStep.NARRATIVE_EXTRACTION);
    expect(getInterviewProcessingResumeStep(undefined)).toBe(PipelineStep.NARRATIVE_EXTRACTION);
    expect(getInterviewProcessingResumeStep(PipelineStep.NARRATIVE_SUMMARY)).toBe(
      PipelineStep.INSIGHT_EXTRACTION
    );
  });

  it('prepareInterviewProcessingRetry session 不存在時應拋 NOT_FOUND 且不更新', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue(null);

    await expect(prepareInterviewProcessingRetry('s1', 'u1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(mockedPrisma.interviewSession.findFirst).toHaveBeenCalledWith({
      where: { id: 's1', user_id: 'u1' },
      select: { id: true, status: true, pipeline_step: true },
    });
    expect(mockedPrisma.interviewSession.update).not.toHaveBeenCalled();
  });

  it('prepareInterviewProcessingRetry session 非 PROCESSING_FAILED 時應拋 VALIDATION_ERROR 且不更新', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue({
      id: 's1',
      status: INTERVIEW_STATUS.COMPLETED,
      pipeline_step: PipelineStep.COMPLETED,
    });

    await expect(prepareInterviewProcessingRetry('s1', 'u1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    expect(mockedPrisma.interviewSession.update).not.toHaveBeenCalled();
  });

  it('prepareInterviewProcessingRetry 應更新為 PROCESSING 並返回下一個 resume step', async () => {
    mockedPrisma.interviewSession.findFirst.mockResolvedValue({
      id: 's1',
      status: INTERVIEW_STATUS.PROCESSING_FAILED,
      pipeline_step: PipelineStep.NARRATIVE_SUMMARY,
    });
    mockedPrisma.interviewSession.update.mockResolvedValue({});

    await expect(prepareInterviewProcessingRetry('s1', 'u1')).resolves.toEqual({
      sessionId: 's1',
      fromStep: PipelineStep.INSIGHT_EXTRACTION,
    });

    expect(mockedPrisma.interviewSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: INTERVIEW_STATUS.PROCESSING },
    });
  });
});
