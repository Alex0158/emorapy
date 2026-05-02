import { describe, expect, it } from 'vitest';
import { getInterviewResumeNavigationPath } from './interviewResume';

describe('interviewResume utils', () => {
  it('有 pending session 時應導航到訪談頁', () => {
    expect(getInterviewResumeNavigationPath({
      has_pending: true,
      session_id: 'pending-1',
    })).toBe('/interview/pending-1');
  });

  it('沒有 pending 但有 failed session 時應導航到 result retry 頁', () => {
    expect(getInterviewResumeNavigationPath({
      has_pending: false,
      has_failed: true,
      failed_session_id: 'failed-1',
    })).toBe('/interview/failed-1/result');
  });

  it('pending 應優先於 failed，避免中斷未完成訪談', () => {
    expect(getInterviewResumeNavigationPath({
      has_pending: true,
      session_id: 'pending-1',
      has_failed: true,
      failed_session_id: 'failed-1',
    })).toBe('/interview/pending-1');
  });

  it('沒有可恢復目標時應返回 null', () => {
    expect(getInterviewResumeNavigationPath({ has_pending: false })).toBeNull();
    expect(getInterviewResumeNavigationPath(null)).toBeNull();
    expect(getInterviewResumeNavigationPath(undefined)).toBeNull();
  });
});
