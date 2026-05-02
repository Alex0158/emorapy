/**
 * Profile Index 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfileIndex from './index';

const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();
const mockNavigate = vi.fn();
const { mockUsePsychProfileStore, mockUseInterviewStore, mockStartSession, mockCheckResume } = vi.hoisted(() => ({
  mockUsePsychProfileStore: vi.fn(),
  mockUseInterviewStore: vi.fn(),
  mockStartSession: vi.fn(),
  mockCheckResume: vi.fn(),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/services/api/user', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', email: 'u@example.com', nickname: 'User' },
    updateUser: vi.fn(),
  }),
}));
vi.mock('@/store/psychProfileStore', () => ({
  usePsychProfileStore: () => mockUsePsychProfileStore(),
}));
vi.mock('@/store/interviewStore', () => ({
  useInterviewStore: () => mockUseInterviewStore(),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/Interview/RichnessRing', () => ({
  default: () => <div data-testid="richness-ring" />,
}));
vi.mock('@/components/business/Interview/ConsentModal', () => ({
  default: () => null,
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      info: vi.fn(),
      warning: vi.fn(),
    },
  };
});

const mockProfile = {
  id: 'u1',
  email: 'u@example.com',
  nickname: 'User',
  avatar_url: null,
};

describe('ProfileIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue(mockProfile);
    mockUsePsychProfileStore.mockReturnValue({
      profile: null,
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockUseInterviewStore.mockReturnValue({
      startSession: vi.fn(),
      checkResume: vi.fn(),
    });
  });

  it('應掛載且不崩潰', async () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalled();
    });
  });

  it('getProfile 失敗應顯示錯誤', async () => {
    mockGetProfile.mockRejectedValue(new Error('取得失敗'));
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('取得失敗');
    });
    expect(await screen.findByText('取得失敗')).toBeInTheDocument();
    expect(screen.getByText('common.back')).toBeInTheDocument();
  });

  it('getProfile 失敗且無 message 時應使用 getProfileIndexFail', async () => {
    mockGetProfile.mockRejectedValue({ code: 'UNKNOWN' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getProfileIndexFail');
    });
  });

  it('getProfile 失敗且 message 為空字串時應使用 getProfileIndexFail（F10 邊界：空 message 視為無）', async () => {
    mockGetProfile.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getProfileIndexFail');
    });
  });

  it('getProfile FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockGetProfile.mockRejectedValue({ code: 'FORBIDDEN', message: '帳號已被停權，無法查看個人資料' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('帳號已被停權，無法查看個人資料');
    });
  });

  it('getProfile FORBIDDEN 且無 message 時應使用 getProfileIndexFail（F08 權限邊界 fallback）', async () => {
    mockGetProfile.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getProfileIndexFail');
    });
  });

  it('getProfile 失敗後應仍可填寫表單並提交，updateProfile 成功應顯示成功訊息（F08 錯誤恢復：失敗不阻塞表單操作）', async () => {
    const user = userEvent.setup();
    mockGetProfile.mockRejectedValue(new Error('網絡錯誤'));
    mockUpdateProfile.mockResolvedValue({ ...mockProfile, nickname: 'Updated' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    });
    const nicknameInput = await screen.findByPlaceholderText('profileIndex.nicknamePlaceholder');
    await user.clear(nicknameInput);
    await user.type(nicknameInput, 'Updated');
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await user.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'Updated' }));
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.profileUpdateSuccess');
    });
  });

  it('getProfile 失敗時應仍可點擊 retry 重新呼叫', async () => {
    mockGetProfile
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockResolvedValueOnce(mockProfile);
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    });
    const retryBtn = screen.getByTestId('profile-index-load-retry');
    expect(retryBtn).toBeInTheDocument();
    expect(screen.getByText('common.back')).toBeInTheDocument();
    await userEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('profile-index-load-retry')).not.toBeInTheDocument();
    });
  });

  it('getProfile 失敗時應仍可點擊返回按鈕並導向上一頁（頁面錯誤出口一致性）', async () => {
    mockGetProfile.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.back')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('common.back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('getProfile 失敗時 retry 快速連點只會送出一次 getProfile 請求（F08/F09 重試節流）', async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise<typeof mockProfile>((resolve) => { resolveFetch = resolve; });
    mockGetProfile.mockRejectedValueOnce(new Error('網絡錯誤')).mockImplementation(() => fetchPromise);
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId('profile-index-load-retry')).toBeInTheDocument();
    });
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByTestId('profile-index-load-retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    expect(mockGetProfile).toHaveBeenCalledTimes(2); // 僅多一次，連點被防護
    resolveFetch!(mockProfile);
    await waitFor(() => {
      expect(screen.queryByTestId('profile-index-load-retry')).not.toBeInTheDocument();
    });
  });

  it('retry 失敗後應仍可再次點擊 retry', async () => {
    mockGetProfile.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    });
    let retryBtn = screen.getByTestId('profile-index-load-retry');
    await userEvent.click(retryBtn);
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalledTimes(2));
    retryBtn = await screen.findByTestId('profile-index-load-retry');
    await userEvent.click(retryBtn);
    await waitFor(() => expect(mockGetProfile).toHaveBeenCalledTimes(3));
  });

  it('getProfile 失敗時若有 psychProfile 應仍可點擊管理我的數據導向 /profile/my-story（錯誤恢復：失敗不阻塞導航）', async () => {
    mockGetProfile.mockRejectedValue(new Error('網絡錯誤'));
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true, narratives: [], insights: [] },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    });
    const manageLink = await screen.findByText('psychProfile.manageMyData');
    expect(manageLink).toBeInTheDocument();
    await userEvent.click(manageLink);
    expect(mockNavigate).toHaveBeenCalledWith('/profile/my-story');
  });

  it('updateProfile 失敗後應仍可再次點擊儲存，成功後應顯示成功（F08 錯誤恢復：失敗不阻塞重試）', async () => {
    const user = userEvent.setup();
    mockUpdateProfile
      .mockRejectedValueOnce(new Error('儲存失敗'))
      .mockResolvedValueOnce(mockProfile);
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await user.click(saveBtn);
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('儲存失敗'));
    await user.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.profileUpdateSuccess');
    });
  });

  it('updateProfile 失敗且錯誤無 message 時應顯示 message.updateFail', async () => {
    mockUpdateProfile.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.updateFail');
    });
  });

  it('updateProfile 失敗且 message 為空字串時應使用 message.updateFail（F10 邊界：空 message 視為無）', async () => {
    mockUpdateProfile.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.updateFail');
    });
  });

  it('updateProfile FORBIDDEN 且無 message 時應使用 updateFail（F08 權限邊界 fallback）', async () => {
    mockUpdateProfile.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.updateFail');
    });
  });

  it('updateProfile FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockUpdateProfile.mockRejectedValue({ code: 'FORBIDDEN', message: '帳號已鎖定，無法更新資料' });
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('帳號已鎖定，無法更新資料');
    });
  });

  it('updateProfile 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveUpdate: (v: unknown) => void;
    mockUpdateProfile.mockImplementation(
      () => new Promise((resolve) => { resolveUpdate = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await userEvent.click(saveBtn);
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled());
    unmount();
    resolveUpdate!(mockProfile);
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
  });

  it('updateProfile 失敗但組件已卸載時不應呼叫 message.error（useMountedRef 回歸：避免卸載後誤提示）', async () => {
    let rejectUpdate: (reason?: unknown) => void;
    mockUpdateProfile.mockImplementation(
      () => new Promise((_, reject) => { rejectUpdate = reject; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await userEvent.click(saveBtn);
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalled());
    unmount();
    await act(async () => {
      rejectUpdate!(new Error('儲存失敗'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('updateProfile 成功應顯示 profileUpdateSuccess（F08 主流程）', async () => {
    mockUpdateProfile.mockResolvedValue(mockProfile);
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.profileUpdateSuccess');
    });
  });

  it('儲存按鈕快速連點只會送出一次 updateProfile 請求', async () => {
    let resolveUpdate: (v: unknown) => void;
    const updatePromise = new Promise((resolve) => { resolveUpdate = resolve; });
    mockUpdateProfile.mockImplementation(() => updatePromise as Promise<typeof mockProfile>);
    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const saveBtn = await screen.findByRole('button', { name: 'profileIndex.saveAria' });
    await userEvent.click(saveBtn);
    await userEvent.click(saveBtn);
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    });
    resolveUpdate!(mockProfile);
  });

  it('繼續聊天 startSession 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveStartSession: (v: unknown) => void;
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockImplementation(
      () => new Promise((resolve) => { resolveStartSession = resolve; })
    );
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });
    const { unmount } = render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);
    await waitFor(() => expect(mockStartSession).toHaveBeenCalled());
    unmount();
    resolveStartSession!({ id: 'sess-1' });
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('繼續聊天 checkResume 有 pending session 時應直接導航且不再 startSession', async () => {
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: true, session_id: 'resume-sess' });
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });

    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );

    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interview/resume-sess');
      expect(mockStartSession).not.toHaveBeenCalled();
    });
  });

  it('繼續聊天 checkResume 有 failed session 時應直接導航到 result retry 頁', async () => {
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({
      has_pending: false,
      has_failed: true,
      failed_session_id: 'failed-sess',
    });
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });

    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );

    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/interview/failed-sess/result');
      expect(mockStartSession).not.toHaveBeenCalled();
    });
  });

  it('繼續聊天 startSession 失敗但組件已卸載時不應呼叫 message.error（useMountedRef 回歸：避免卸載後誤提示）', async () => {
    let rejectStartSession: (reason?: unknown) => void;
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockImplementation(
      () => new Promise((_, reject) => { rejectStartSession = reject; })
    );
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });
    const { unmount } = render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );
    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);
    await waitFor(() => expect(mockStartSession).toHaveBeenCalled());
    unmount();
    await act(async () => {
      rejectStartSession!(new Error('啟動訪談失敗'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('繼續聊天 startSession 失敗後應仍可再次點擊繼續聊天，成功後應導航（F08 錯誤恢復：失敗不阻塞重試）', async () => {
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession
      .mockRejectedValueOnce(new Error('網路錯誤'))
      .mockResolvedValueOnce({ id: 'sess-1' });
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });

    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );

    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('網路錯誤'));
    await userEvent.click(continueBtn);
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('/interview/sess-1');
    });
  });

  it('繼續聊天 startSession 失敗且有 message 應顯示該 message（F06 錯誤處理約定）', async () => {
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockRejectedValue(new Error('啟動訪談失敗'));
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });

    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );

    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('啟動訪談失敗');
    });
  });

  it('繼續聊天 startSession 失敗且無 message 應顯示 interview.startFail', async () => {
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockRejectedValue({ code: 'SERVER_ERROR' });
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });

    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );

    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('繼續聊天 startSession 失敗且 message 為空字串時應使用 interview.startFail（F10 邊界：空 message 視為無）', async () => {
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockRejectedValue({ code: 'AI_SERVICE_ERROR', message: '' });
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });

    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );

    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('繼續聊天 startSession FORBIDDEN 且無 message 時應使用 interview.startFail（F06/F08 權限邊界 fallback）', async () => {
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: false });
    mockStartSession.mockRejectedValue({ code: 'FORBIDDEN' });
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });

    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );

    const continueBtn = await screen.findByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('interview.startFail');
    });
  });

  it('繼續訪談快速連點只會送出一次 startSession 請求', async () => {
    mockUsePsychProfileStore.mockReturnValue({
      profile: { consent_given: true },
      fetchProfile: vi.fn(),
      giveConsent: vi.fn(),
      consentLoading: false,
    });
    mockCheckResume.mockResolvedValue({ has_pending: false, session_id: null });
    const startPromise = new Promise<{ id: string }>((resolve) => {
      (mockStartSession as ReturnType<typeof vi.fn>).mockImplementation(() => startPromise);
    });
    mockStartSession.mockImplementation(() => startPromise);
    mockUseInterviewStore.mockReturnValue({
      startSession: mockStartSession,
      checkResume: mockCheckResume,
    });

    render(
      <MemoryRouter>
        <ProfileIndex />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('psychProfile.continueChat')).toBeInTheDocument();
    });

    const continueBtn = screen.getByText('psychProfile.continueChat');
    await userEvent.click(continueBtn);
    await userEvent.click(continueBtn);
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledTimes(1);
    });
  });
});
