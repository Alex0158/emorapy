import { PipelineStep } from '../types/interview.types';
import { INTERVIEW_STATUS } from '../utils/constants';

export const PIPELINE_RESUME_VALIDATION_MESSAGE = '僅可重試處理失敗的訪談';
export const USER_RETRYABLE_PIPELINE_STATUSES = [
  INTERVIEW_STATUS.PROCESSING_FAILED,
] as const;
export const INTERNAL_PIPELINE_RESUME_STATUSES = [
  INTERVIEW_STATUS.PROCESSING_FAILED,
  INTERVIEW_STATUS.PROCESSING,
] as const;

export function getNextPipelineResumeStep(
  pipelineStep: number | null | undefined
): number {
  return (pipelineStep ?? PipelineStep.NOT_STARTED) + 1;
}

export function isUserRetryablePipelineStatus(status: string): boolean {
  return (USER_RETRYABLE_PIPELINE_STATUSES as readonly string[]).includes(status);
}

export function isInternalPipelineResumeStatus(status: string): boolean {
  return (INTERNAL_PIPELINE_RESUME_STATUSES as readonly string[]).includes(status);
}
