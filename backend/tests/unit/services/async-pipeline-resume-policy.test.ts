import { describe, expect, it } from '@jest/globals';
import { PipelineStep } from '../../../src/types/interview.types';
import { INTERVIEW_STATUS } from '../../../src/utils/constants';
import {
  INTERNAL_PIPELINE_RESUME_STATUSES,
  PIPELINE_RESUME_VALIDATION_MESSAGE,
  USER_RETRYABLE_PIPELINE_STATUSES,
  getNextPipelineResumeStep,
  isInternalPipelineResumeStatus,
  isUserRetryablePipelineStatus,
} from '../../../src/services/async-pipeline-resume-policy';

describe('async-pipeline-resume-policy', () => {
  it('PIPELINE_RESUME_VALIDATION_MESSAGE 應統一 retry/resume 驗證錯誤文案', () => {
    expect(PIPELINE_RESUME_VALIDATION_MESSAGE).toBe('僅可重試處理失敗的訪談');
  });

  it('getNextPipelineResumeStep 應保留 last successful pipeline_step + 1 語義', () => {
    expect(getNextPipelineResumeStep(null)).toBe(PipelineStep.NARRATIVE_EXTRACTION);
    expect(getNextPipelineResumeStep(undefined)).toBe(PipelineStep.NARRATIVE_EXTRACTION);
    expect(getNextPipelineResumeStep(PipelineStep.NARRATIVE_SUMMARY)).toBe(
      PipelineStep.INSIGHT_EXTRACTION
    );
    expect(getNextPipelineResumeStep(PipelineStep.FEEDBACK_GENERATION)).toBe(
      PipelineStep.COMPLETED
    );
  });

  it('isUserRetryablePipelineStatus 應只允許用戶側 retry processing_failed', () => {
    expect(USER_RETRYABLE_PIPELINE_STATUSES).toEqual([INTERVIEW_STATUS.PROCESSING_FAILED]);
    expect(isUserRetryablePipelineStatus(INTERVIEW_STATUS.PROCESSING_FAILED)).toBe(true);
    expect(isUserRetryablePipelineStatus(INTERVIEW_STATUS.PROCESSING)).toBe(false);
    expect(isUserRetryablePipelineStatus(INTERVIEW_STATUS.COMPLETED)).toBe(false);
  });

  it('isInternalPipelineResumeStatus 應允許 pipeline 內部 resume processing_failed 或 processing', () => {
    expect(INTERNAL_PIPELINE_RESUME_STATUSES).toEqual([
      INTERVIEW_STATUS.PROCESSING_FAILED,
      INTERVIEW_STATUS.PROCESSING,
    ]);
    expect(isInternalPipelineResumeStatus(INTERVIEW_STATUS.PROCESSING_FAILED)).toBe(true);
    expect(isInternalPipelineResumeStatus(INTERVIEW_STATUS.PROCESSING)).toBe(true);
    expect(isInternalPipelineResumeStatus(INTERVIEW_STATUS.IN_PROGRESS)).toBe(false);
    expect(isInternalPipelineResumeStatus(INTERVIEW_STATUS.COMPLETED)).toBe(false);
  });
});
