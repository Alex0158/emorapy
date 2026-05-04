/**
 * Profile Pairing 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePairing from './index';
import type { Pairing } from '@/services/api/pairing';

const mockNavigate = vi.fn();
const mockStartSession = vi.fn();
const mockCheckResume = vi.fn();
const mockGiveConsent = vi.fn();
const mockGetPairingStatus = vi.fn();
const mockCreatePairing = vi.fn();
const mockJoinPairing = vi.fn();
const mockCancelPairing = vi.fn();
const mockGetRelationshipProfile = vi.fn();
const mockUpsertRelationshipProfile = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastWarning = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/services/api/pairing', () => ({
  createPairing: (...args: unknown[]) => mockCreatePairing(...args),
  joinPairing: (...args: unknown[]) => mockJoinPairing(...args),
  getPairingStatus: (...args: unknown[]) => mockGetPairingStatus(...args),
  cancelPairing: (...args: unknown[]) => mockCancelPairing(...args),
}));
vi.mock('@/services/api/profile', () => ({
  getRelationshipProfile: (...args: unknown[]) => mockGetRelationshipProfile(...args),
  upsertRelationshipProfile: (...args: unknown[]) => mockUpsertRelationshipProfile(...args),
}));

vi.mock('@/store/psychProfileStore', () => ({
  usePsychProfileStore: () => ({
    profile: null,
    fetchProfile: vi.fn(),
    giveConsent: mockGiveConsent,
    consentLoading: false,
  }),
}));

vi.mock('@/store/interviewStore', () => ({
  useInterviewStore: () => ({
    startSession: mockStartSession,
    checkResume: mockCheckResume,
  }),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/ConfirmModal', () => ({
  default: ({ onConfirm, open }: { onConfirm?: () => void; open?: boolean }) =>
    open && onConfirm ? (
      <button type="button" onClick={onConfirm}>
        Confirm Cancel
      </button>
    ) : null,
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
    info: vi.fn(),
  },
}));

describe('ProfilePairing', () => {
  const activePairing: Pairing = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    status: 'active',
    pairing_type: 'normal',
    created_at: new Date().toISOString(),
    user1: { id: 'u1', nickname: 'A' },
    user2: { id: 'u2', nickname: 'B' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPairingStatus.mockReset();
    mockGetPairingStatus.mockResolvedValue(null);
    mockCreatePairing.mockReset();
    mockJoinPairing.mockReset();
    mockCancelPairing.mockReset();
    mockGetRelationshipProfile.mockReset();
    mockGetRelationshipProfile.mockResolvedValue(null);
    mockUpsertRelationshipProfile.mockReset();
    mockUpsertRelationshipProfile.mockResolvedValue(null);
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockResolvedValue({ id: 'test-session-id' });
    mockGiveConsent.mockResolvedValue(undefined);
  });

  it('應掛載且不崩潰', async () => {
    const { container } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('pairing.heading')).toBeInTheDocument();
    });
  });

  it('配對成功時應讀取並可保存關係檔案', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_stage: 'stable',
      relationship_strengths: '互相信任',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_stage: 'stable',
      relationship_strengths: '建立每週回顧',
      completion_percentage: 75,
    });

    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });

    expect(mockGetRelationshipProfile).toHaveBeenCalledWith(activePairing.id);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('pairing.relationshipStrengthsPlaceholder')).toBeInTheDocument();
    });
    const strengthsInput = screen.getByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, {
      target: { value: '建立每週回顧' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));

    await waitFor(() => {
      expect(mockUpsertRelationshipProfile).toHaveBeenCalledWith(
        activePairing.id,
        expect.objectContaining({
          relationship_strengths: '建立每週回顧',
        })
      );
    });
  });

  it('未進入配對成功態時不應顯示訪談 trigger', async () => {
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('pairing.heading')).toBeInTheDocument();
    });

    expect(screen.queryByText('trigger.bannerOk')).not.toBeInTheDocument();
  });

  it('getPairingStatus 失敗時應顯示錯誤並清空配對', async () => {
    mockGetPairingStatus.mockRejectedValue(new Error('獲取失敗'));
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('獲取失敗');
    });
  });

  it('getPairingStatus FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockGetPairingStatus.mockRejectedValue({ code: 'FORBIDDEN', message: '帳號已停權，無法使用配對功能' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('帳號已停權，無法使用配對功能');
    });
  });

  it('getPairingStatus FORBIDDEN 且無 message 時應使用 getPairingFail（F08 權限邊界 fallback）', async () => {
    mockGetPairingStatus.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.getPairingFail');
    });
  });

  it('getPairingStatus 失敗且無 message 時應使用 getPairingFail', async () => {
    mockGetPairingStatus.mockRejectedValue({ code: 'UNKNOWN' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.getPairingFail');
    });
  });

  it('getPairingStatus 失敗且 message 為空字串時應使用 getPairingFail（F10 邊界：空 message 視為無）', async () => {
    mockGetPairingStatus.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.getPairingFail');
    });
  });

  it('getPairingStatus 失敗時應仍可點擊 retry 或前往個人設定導向 /profile/settings（F08 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetPairingStatus.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    const goSettingsBtn = screen.getByText('pairing.goToSettings');
    expect(goSettingsBtn).toBeInTheDocument();
    fireEvent.click(goSettingsBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/profile/settings');
  });

  it('getPairingStatus 失敗時點擊 retry 應重新呼叫 getPairingStatus', async () => {
    mockGetPairingStatus
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockResolvedValueOnce(null);
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalledTimes(2);
    });
  });

  it('getPairingStatus 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示配對狀態（F08 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetPairingStatus
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockRejectedValueOnce(new Error('重試時服務不可用'))
      .mockResolvedValueOnce(null);
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(screen.getByText('pairing.createButton')).toBeInTheDocument();
    });
  });

  it('getPairingStatus 失敗時 retry 再次失敗應顯示該次錯誤訊息（F08 重試錯誤反饋）', async () => {
    mockGetPairingStatus.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetPairingStatus).toHaveBeenCalledTimes(1);
    mockGetPairingStatus.mockRejectedValueOnce(new Error('重試時服務不可用'));
    fireEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('重試時服務不可用');
    });
  });

  it('getPairingStatus 失敗時 retry 再次失敗且 message 為空字串應使用 getPairingFail（F10 邊界）', async () => {
    mockGetPairingStatus.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockGetPairingStatus.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    fireEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.getPairingFail');
    });
  });

  it('getPairingStatus 失敗時 retry 快速連點只會送出一次 getPairingStatus 請求（F08 重試節流）', async () => {
    let resolveFetch: (v: unknown) => void;
    mockGetPairingStatus
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetPairingStatus).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByText('common.retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalledTimes(2);
    });
    resolveFetch!(null);
    await waitFor(() => {
      expect(screen.queryByText('common.retry')).not.toBeInTheDocument();
    });
  });

  it('startInterviewFlow 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveStartSession: (v: unknown) => void;
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockImplementation(
      () => new Promise((resolve) => { resolveStartSession = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => expect(mockStartSession).toHaveBeenCalled());
    unmount();
    resolveStartSession!({ id: 'test-session-id' });
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('同意後 startSession 失敗且有 message 應顯示該 message（F06/F08 錯誤處理約定）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockStartSession.mockRejectedValue(new Error('啟動訪談失敗'));
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('啟動訪談失敗');
    });
  });

  it('同意後 startSession 失敗且無 message 應顯示 interview.startFail', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockStartSession.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('同意後 startSession 失敗且 message 為空字串時應使用 interview.startFail（F10 邊界）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockStartSession.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('同意後 startSession FORBIDDEN 且無 message 時應使用 interview.startFail（F06/F08 權限邊界 fallback）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockStartSession.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('同意後 checkResume 有 pending session 時應直接導航到該訪談且不再 startSession（P0-05 回流一致性）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockCheckResume.mockResolvedValue({ has_pending: true, session_id: 'resume-pairing-session' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => {
      expect(mockCheckResume).toHaveBeenCalled();
      expect(mockStartSession).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/interview/resume-pairing-session');
    });
  });

  it('同意後 checkResume 有 failed session 時應直接導航到 result retry 頁且不再 startSession', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockCheckResume.mockResolvedValue({
      has_pending: false,
      has_failed: true,
      failed_session_id: 'failed-pairing-session',
    });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => {
      expect(mockCheckResume).toHaveBeenCalled();
      expect(mockStartSession).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/interview/failed-pairing-session/result');
    });
  });

  it('同意流程中 giveConsent 尚未完成就卸載時不應呼叫 message.error 或 navigate（P1-04）', async () => {
    let resolveConsent: (v: unknown) => void;
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGiveConsent.mockImplementation(
      () => new Promise((resolve) => { resolveConsent = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => {
      expect(mockGiveConsent).toHaveBeenCalled();
    });
    unmount();
    resolveConsent!(undefined);
    await Promise.resolve();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('同意流程中 giveConsent 失敗但組件已卸載時不應呼叫 message.error（P1-04）', async () => {
    let rejectConsent: (error?: unknown) => void;
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGiveConsent.mockImplementation(
      () => new Promise((_, reject) => { rejectConsent = reject; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('trigger.bannerOk')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('trigger.bannerOk'));
    await waitFor(() => {
      expect(screen.getByText('consent.agree')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('consent.agree'));
    fireEvent.click(screen.getByText('consent.start'));
    await waitFor(() => {
      expect(mockGiveConsent).toHaveBeenCalled();
    });
    unmount();
    rejectConsent!(new Error('同意提交失敗'));
    await Promise.resolve();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('createPairing 失敗且錯誤無 message 時應顯示 message.createPairingFail', async () => {
    mockCreatePairing.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.createButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.createButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.createPairingFail');
    });
  });

  it('createPairing 失敗且 message 為空字串時應使用 createPairingFail（F10 邊界：空 message 視為無）', async () => {
    mockCreatePairing.mockRejectedValue({ code: 'AI_SERVICE_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.createButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.createButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.createPairingFail');
    });
  });

  it('createPairing FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockCreatePairing.mockRejectedValue({ code: 'FORBIDDEN', message: '您已有進行中的配對' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.createButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.createButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('您已有進行中的配對');
    });
  });

  it('createPairing FORBIDDEN 且無 message 時應使用 createPairingFail（F08 權限邊界 fallback）', async () => {
    mockCreatePairing.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.createButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.createButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.createPairingFail');
    });
  });

  it('createPairing 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveCreate: (v: unknown) => void;
    mockCreatePairing.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pairing\.createButton/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.createButton/ }));
    await waitFor(() => expect(mockCreatePairing).toHaveBeenCalled());
    unmount();
    resolveCreate!(activePairing);
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('createPairing 失敗後應仍可再次點擊建立配對，成功後應顯示配對狀態（F08 錯誤恢復：失敗不阻塞重試）', async () => {
    const createdPairing = { id: 'pair-retry', status: 'pending' as const, invite_code: 'RETRY12' };
    mockCreatePairing
      .mockRejectedValueOnce(new Error('暫時無法建立'))
      .mockResolvedValueOnce(createdPairing);
    mockGetRelationshipProfile.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.createButton')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.createButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('暫時無法建立');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pairing\.createButton/ })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.createButton/ }));
    await waitFor(() => {
      expect(mockCreatePairing).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.createPairingSuccess');
      expect(screen.getByText('pairing.inviteCode')).toBeInTheDocument();
    });
  });

  it('joinPairing 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveJoin: (v: unknown) => void;
    mockJoinPairing.mockImplementation(
      () => new Promise((resolve) => { resolveJoin = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('pairing.joinPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('pairing.joinPlaceholder'), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.joinButton/ }));
    await waitFor(() => expect(mockJoinPairing).toHaveBeenCalled());
    unmount();
    resolveJoin!(activePairing);
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('joinPairing 失敗後應仍可再次點擊加入，成功後應顯示配對狀態（F08 錯誤恢復：失敗不阻塞重試）', async () => {
    const joinedPairing = { id: 'pair-joined', status: 'pending' as const, invite_code: 'JOINED1' };
    mockJoinPairing
      .mockRejectedValueOnce(new Error('網路暫時不穩'))
      .mockResolvedValueOnce(joinedPairing);
    mockGetRelationshipProfile.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('pairing.joinPlaceholder')).toBeInTheDocument();
    });
    const joinInput = screen.getByPlaceholderText('pairing.joinPlaceholder');
    fireEvent.change(joinInput, { target: { value: 'ABC123' } });
    await waitFor(() => expect(joinInput).toHaveValue('ABC123'));
    fireEvent.click(screen.getByRole('button', { name: /pairing\.joinButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('網路暫時不穩');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pairing\.joinButton/ })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.joinButton/ }));
    await waitFor(() => {
      expect(mockJoinPairing).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.joinPairingSuccess');
      expect(screen.getByText('pairing.inviteCode')).toBeInTheDocument();
    });
  });

  it('joinPairing 失敗且錯誤無 message 時應顯示 message.joinPairingFail', async () => {
    mockJoinPairing.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('pairing.joinPlaceholder')).toBeInTheDocument();
    });
    const joinInput = screen.getByPlaceholderText('pairing.joinPlaceholder');
    fireEvent.change(joinInput, { target: { value: 'ABC123' } });
    await waitFor(() => expect(joinInput).toHaveValue('ABC123'));
    fireEvent.click(screen.getByRole('button', { name: /pairing\.joinButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.joinPairingFail');
    });
  });

  it('joinPairing 失敗且 message 為空字串時應使用 joinPairingFail（F10 邊界：空 message 視為無）', async () => {
    mockJoinPairing.mockRejectedValue({ code: 'INVITE_CODE_EXPIRED', message: '' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('pairing.joinPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('pairing.joinPlaceholder'), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.joinButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.joinPairingFail');
    });
  });

  it('joinPairing FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockJoinPairing.mockRejectedValue({ code: 'FORBIDDEN', message: '此邀請碼已失效' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('pairing.joinPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('pairing.joinPlaceholder'), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.joinButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('此邀請碼已失效');
    });
  });

  it('joinPairing FORBIDDEN 且無 message 時應使用 joinPairingFail（F08 權限邊界 fallback）', async () => {
    mockJoinPairing.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('pairing.joinPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('pairing.joinPlaceholder'), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /pairing\.joinButton/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.joinPairingFail');
    });
  });

  it('有配對時 getRelationshipProfile 失敗應顯示 relationshipProfileLoadFail', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.relationshipProfileLoadFail');
    });
  });

  it('有配對時 getRelationshipProfile 失敗且 message 為空字串時應使用 relationshipProfileLoadFail（F10 邊界）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.relationshipProfileLoadFail');
    });
  });

  it('有配對時 getRelationshipProfile FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限查看此配對的關係檔案' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('無權限查看此配對的關係檔案');
    });
  });

  it('有配對時 getRelationshipProfile FORBIDDEN 且無 message 時應使用 relationshipProfileLoadFail（F08 權限邊界 fallback）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.relationshipProfileLoadFail');
    });
  });

  it('保存關係檔案時 upsertRelationshipProfile 失敗應顯示錯誤', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockRejectedValue(new Error('保存失敗'));
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
    const strengthsInput = await screen.findByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, { target: { value: '新內容' } });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('保存失敗');
    });
  });

  it('保存關係檔案失敗且 message 為空字串時應使用 relationshipProfileSaveFail（F10 邊界）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockRejectedValue({ code: 'DATABASE_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
    const strengthsInput = await screen.findByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, { target: { value: '新內容' } });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.relationshipProfileSaveFail');
    });
  });

  it('保存關係檔案失敗且無 message 時應使用 message.relationshipProfileSaveFail', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
    const strengthsInput = await screen.findByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, { target: { value: '新內容' } });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.relationshipProfileSaveFail');
    });
  });

  it('saveRelationshipProfile 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveSave: (v: unknown) => void;
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
    const strengthsInput = await screen.findByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, { target: { value: '新內容' } });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));
    await waitFor(() => expect(mockUpsertRelationshipProfile).toHaveBeenCalled());
    unmount();
    resolveSave!({
      pairing_id: activePairing.id,
      relationship_strengths: '新內容',
      completion_percentage: 70,
    });
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('upsertRelationshipProfile 失敗後應仍可再次點擊保存，成功後應顯示成功（F08 錯誤恢復：失敗不阻塞重試）', async () => {
    const savedProfile = {
      pairing_id: activePairing.id,
      relationship_strengths: '重試後',
      completion_percentage: 80,
    };
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile
      .mockRejectedValueOnce(new Error('暫時無法保存'))
      .mockResolvedValueOnce(savedProfile);
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
    const strengthsInput = await screen.findByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, { target: { value: '新內容' } });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('暫時無法保存');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));
    await waitFor(() => {
      expect(mockUpsertRelationshipProfile).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.relationshipProfileSaveSuccess');
    });
  });

  it('保存關係檔案 upsertRelationshipProfile FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockRejectedValue({ code: 'FORBIDDEN', message: '此配對已鎖定，無法編輯' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
    const strengthsInput = await screen.findByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, { target: { value: '新內容' } });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('此配對已鎖定，無法編輯');
    });
  });

  it('保存關係檔案 upsertRelationshipProfile FORBIDDEN 且無 message 時應使用 relationshipProfileSaveFail（F08 權限邊界 fallback）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
    const strengthsInput = await screen.findByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, { target: { value: '新內容' } });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.relationshipProfileSaveFail');
    });
  });

  it('saveRelationshipProfile 快速連點只會送出一次請求', async () => {
    let resolveSave: (v: unknown) => void;
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockUpsertRelationshipProfile.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; })
    );
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
    const strengthsInput = await screen.findByPlaceholderText('pairing.relationshipStrengthsPlaceholder');
    fireEvent.change(strengthsInput, { target: { value: '新內容' } });
    const saveBtn = screen.getByRole('button', { name: 'pairing.saveRelationshipProfile' });
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpsertRelationshipProfile).toHaveBeenCalledTimes(1);
    });
    resolveSave!({
      pairing_id: activePairing.id,
      relationship_strengths: '新內容',
      completion_percentage: 70,
    });
    await waitFor(() => {
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  it('cancelPairing 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveCancel: (v: unknown) => void;
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '',
      completion_percentage: 0,
    });
    mockCancelPairing.mockImplementation(
      () => new Promise((resolve) => { resolveCancel = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.cancelPairing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.cancelPairing' }));
    fireEvent.click(screen.getByText('Confirm Cancel'));
    await waitFor(() => expect(mockCancelPairing).toHaveBeenCalled());
    unmount();
    resolveCancel!({ ...activePairing, status: 'cancelled' });
    await Promise.resolve();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('cancelPairing FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '',
      completion_percentage: 0,
    });
    mockCancelPairing.mockRejectedValue({ code: 'FORBIDDEN', message: '此配對已無法取消' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.cancelPairing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.cancelPairing' }));
    fireEvent.click(screen.getByText('Confirm Cancel'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('此配對已無法取消');
    });
  });

  it('cancelPairing FORBIDDEN 且無 message 時應使用 cancelPairingFail（F08 權限邊界 fallback）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockCancelPairing.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.cancelPairing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.cancelPairing' }));
    fireEvent.click(screen.getByText('Confirm Cancel'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.cancelPairingFail');
    });
  });

  it('cancelPairing 失敗且 message 為空字串時應使用 cancelPairingFail（F10 邊界：空 message 視為無）', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockCancelPairing.mockRejectedValue({ code: 'CONFLICT', message: '' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.cancelPairing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.cancelPairing' }));
    fireEvent.click(screen.getByText('Confirm Cancel'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.cancelPairingFail');
    });
  });

  it('cancelPairing 失敗且錯誤無 message 時應顯示 message.cancelPairingFail', async () => {
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '原有',
      completion_percentage: 70,
    });
    mockCancelPairing.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.cancelPairing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.cancelPairing' }));
    fireEvent.click(screen.getByText('Confirm Cancel'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('message.cancelPairingFail');
    });
  });

  it('cancelPairing 失敗後應仍可再次點擊取消，成功後應顯示配對已取消（F08 錯誤恢復：失敗不阻塞重試）', async () => {
    const cancelledPairing = { ...activePairing, status: 'cancelled' as const };
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '',
      completion_percentage: 0,
    });
    mockCancelPairing
      .mockRejectedValueOnce(new Error('暫時無法取消'))
      .mockResolvedValueOnce(cancelledPairing);
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.cancelPairing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.cancelPairing' }));
    fireEvent.click(screen.getByText('Confirm Cancel'));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('暫時無法取消');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.cancelPairing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.cancelPairing' }));
    fireEvent.click(screen.getByText('Confirm Cancel'));
    await waitFor(() => {
      expect(mockCancelPairing).toHaveBeenCalledTimes(2);
      expect(mockToastSuccess).toHaveBeenCalledWith('message.cancelPairingSuccess');
    });
  });

  it('cancelPairing 快速連點只會送出一次請求', async () => {
    let resolveCancel: (v: unknown) => void;
    mockGetPairingStatus.mockResolvedValue(activePairing);
    mockGetRelationshipProfile.mockResolvedValue({
      pairing_id: activePairing.id,
      relationship_strengths: '',
      completion_percentage: 0,
    });
    mockCancelPairing.mockImplementation(
      () => new Promise((resolve) => { resolveCancel = resolve; })
    );
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'pairing.cancelPairing' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'pairing.cancelPairing' }));
    const confirmBtn = screen.getByText('Confirm Cancel');
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockCancelPairing).toHaveBeenCalledTimes(1);
    });
    resolveCancel!({ ...activePairing, status: 'cancelled' });
    await waitFor(() => {
      expect(screen.getByText(/pairing\.(createButton|heading)/)).toBeInTheDocument();
    });
  });

  it('createPairing 快速連點只會送出一次請求', async () => {
    let resolveCreate: (v: unknown) => void;
    mockCreatePairing.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; })
    );
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pairing\.createButton/ })).toBeInTheDocument();
    });
    const createBtn = screen.getByRole('button', { name: /pairing\.createButton/ });
    fireEvent.click(createBtn);
    fireEvent.click(createBtn);
    fireEvent.click(createBtn);
    await waitFor(() => {
      expect(mockCreatePairing).toHaveBeenCalledTimes(1);
    });
    resolveCreate!(activePairing);
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
  });

  it('joinPairing 快速連點只會送出一次請求', async () => {
    let resolveJoin: (v: unknown) => void;
    mockJoinPairing.mockImplementation(
      () => new Promise((resolve) => { resolveJoin = resolve; })
    );
    render(
      <MemoryRouter>
        <ProfilePairing />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('pairing.joinPlaceholder')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('pairing.joinPlaceholder'), {
      target: { value: 'ABC123' },
    });
    const joinBtn = screen.getByRole('button', { name: /pairing\.joinButton/ });
    fireEvent.click(joinBtn);
    fireEvent.click(joinBtn);
    fireEvent.click(joinBtn);
    await waitFor(() => {
      expect(mockJoinPairing).toHaveBeenCalledTimes(1);
    });
    resolveJoin!(activePairing);
    await waitFor(() => {
      expect(screen.getByText('pairing.relationshipTitle')).toBeInTheDocument();
    });
  });
});
