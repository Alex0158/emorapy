/**
 * useInterviewTrigger Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

const mockStartSession = vi.fn();
const mockCheckResume = vi.fn();
const mockGiveConsent = vi.fn();

vi.mock('@/store/interviewStore', () => ({
  useInterviewStore: () => ({
    startSession: mockStartSession,
    checkResume: mockCheckResume,
  }),
}));

vi.mock('@/store/psychProfileStore', () => ({
  usePsychProfileStore: () => ({
    giveConsent: mockGiveConsent,
    consentLoading: false,
  }),
}));

import { useInterviewTrigger } from './useInterviewTrigger';

describe('useInterviewTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始時 consentOpen 為 false、profileConsent 為 false', () => {
    const { result } = renderHook(() => useInterviewTrigger('organic'));
    expect(result.current.consentOpen).toBe(false);
    expect(result.current.profileConsent).toBe(false);
    expect(typeof result.current.triggerInterview).toBe('function');
    expect(typeof result.current.handleConsent).toBe('function');
  });

  it('未同意時 triggerInterview 應打開 consentOpen', async () => {
    const { result } = renderHook(() => useInterviewTrigger('organic'));
    await act(async () => {
      await result.current.triggerInterview();
    });
    expect(result.current.consentOpen).toBe(true);
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('已同意時 triggerInterview 應 checkResume 並 startSession', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockResolvedValue({ id: 'new-session' });
    const { result } = renderHook(() => useInterviewTrigger('organic'));
    act(() => {
      result.current.setProfileConsent(true);
    });
    await act(async () => {
      await result.current.triggerInterview();
    });
    expect(mockCheckResume).toHaveBeenCalled();
    expect(mockStartSession).toHaveBeenCalledWith('organic');
    expect(mockNavigate).toHaveBeenCalledWith('/interview/new-session');
  });

  it('checkResume 有 pending session 時應直接導航到該 session', async () => {
    mockCheckResume.mockResolvedValue({ has_pending: true, session_id: 'existing' });
    const { result } = renderHook(() => useInterviewTrigger('organic'));
    act(() => {
      result.current.setProfileConsent(true);
    });
    await act(async () => {
      await result.current.triggerInterview();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/interview/existing');
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('checkResume 有 failed session 時應直接導航到 result retry 頁', async () => {
    mockCheckResume.mockResolvedValue({
      has_pending: false,
      has_failed: true,
      failed_session_id: 'failed-existing',
    });
    const { result } = renderHook(() => useInterviewTrigger('organic'));
    act(() => {
      result.current.setProfileConsent(true);
    });
    await act(async () => {
      await result.current.triggerInterview();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/interview/failed-existing/result');
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('startFlow 失敗時應顯示錯誤訊息', async () => {
    mockCheckResume.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useInterviewTrigger('organic'));
    act(() => {
      result.current.setProfileConsent(true);
    });
    await act(async () => {
      await result.current.triggerInterview();
    });
    expect(mockToastError).toHaveBeenCalledWith('interview.startFail');
  });

  it('handleConsent 成功後應同意並啟動 session', async () => {
    mockGiveConsent.mockResolvedValue(undefined);
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockResolvedValue({ id: 's-consent' });
    const { result } = renderHook(() => useInterviewTrigger('pre_case'));
    await act(async () => {
      await result.current.handleConsent();
    });
    expect(mockGiveConsent).toHaveBeenCalled();
    expect(result.current.profileConsent).toBe(true);
    expect(result.current.consentOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/interview/s-consent');
  });

  it('handleConsent 失敗時應顯示錯誤訊息', async () => {
    mockGiveConsent.mockRejectedValue(new Error('consent fail'));
    const { result } = renderHook(() => useInterviewTrigger('organic'));
    await act(async () => {
      await result.current.handleConsent();
    });
    expect(mockToastError).toHaveBeenCalledWith('interview.startFail');
  });
});
