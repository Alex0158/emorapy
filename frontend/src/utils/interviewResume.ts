import type { InterviewResumeStatus } from '@/types/interview';

export function getInterviewResumeNavigationPath(
  resumeData: InterviewResumeStatus | null | undefined
): string | null {
  if (resumeData?.has_pending && resumeData.session_id) {
    return `/interview/${resumeData.session_id}`;
  }

  if (resumeData?.has_failed && resumeData.failed_session_id) {
    return `/interview/${resumeData.failed_session_id}/result`;
  }

  return null;
}
