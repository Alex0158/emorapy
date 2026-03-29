/**
 * Profile Settings 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileSettings from './index';

const mockNavigate = vi.fn();
const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();
const mockUpdateUser = vi.fn();
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
    user: { id: 'u1' },
    updateUser: mockUpdateUser,
  }),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

describe('ProfileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({
      id: 'u1',
      notification_enabled: true,
    });
  });

  it('應掛載且不崩潰', async () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalled();
    });
  });

  it('getProfile 失敗且無 message 時應顯示 getProfileFail', async () => {
    mockGetProfile.mockRejectedValue({ code: 'UNKNOWN' });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getProfileFail');
    });
  });

  it('getProfile 失敗且 message 為空字串時應使用 getProfileFail（F10 邊界）', async () => {
    mockGetProfile.mockRejectedValue({ code: 'UNKNOWN', message: '' });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getProfileFail');
    });
  });

  it('getProfile FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockGetProfile.mockRejectedValue({ code: 'FORBIDDEN', message: '帳號已被停權' });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('帳號已被停權');
    });
    expect(screen.getByText('帳號已被停權')).toBeInTheDocument();
  });

  it('getProfile FORBIDDEN 且無 message 時應使用 getProfileFail（F09 權限邊界 fallback）', async () => {
    mockGetProfile.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getProfileFail');
    });
  });

  it('getProfile 失敗時點擊 retry 應重新呼叫 getProfile，成功後應顯示表單（F09 重試分支）', async () => {
    mockGetProfile.mockRejectedValue(new Error('載入失敗'));
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('載入失敗')).toBeInTheDocument();
    });
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    mockGetProfile.mockResolvedValueOnce({ id: 'u1', notification_enabled: true });
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('settings.save')).toBeInTheDocument();
    });
  });

  it('getProfile 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示表單（F09 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetProfile.mockRejectedValue(new Error('載入失敗'));
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockGetProfile.mockRejectedValueOnce(new Error('重試時網路逾時'));
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockGetProfile.mockResolvedValueOnce({ id: 'u1', notification_enabled: true });
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(screen.getByText('settings.save')).toBeInTheDocument();
    });
  });

  it('getProfile 失敗時 retry 再次失敗應顯示該次錯誤訊息（F09 重試錯誤反饋）', async () => {
    mockGetProfile.mockRejectedValue(new Error('載入失敗'));
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    mockGetProfile.mockRejectedValueOnce(new Error('重試時網路逾時'));
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('重試時網路逾時');
    });
  });

  it('getProfile 失敗時 retry 再次失敗且 message 為空字串應使用 getProfileFail（F10 邊界）', async () => {
    mockGetProfile.mockRejectedValue(new Error('載入失敗'));
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockGetProfile.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getProfileFail');
    });
  });

  it('getProfile 失敗時應仍可點擊 retry 或前往個人資料導向 /profile/index（F09 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetProfile.mockRejectedValue(new Error('載入失敗'));
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(screen.getByText('settings.goToProfile')).toBeInTheDocument();
    fireEvent.click(screen.getByText('settings.goToProfile'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile/index');
  });

  it('getProfile 失敗時 retry 快速連點只會送出一次 getProfile 請求（F09 重試節流）', async () => {
    let resolveGetProfile: (v: unknown) => void;
    const getProfilePromise = new Promise((resolve) => { resolveGetProfile = resolve; });
    mockGetProfile.mockRejectedValueOnce(new Error('載入失敗')).mockImplementation(() => getProfilePromise as Promise<unknown>);
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByRole('button', { name: 'common.retry' });
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(2);
    });
    resolveGetProfile!({ id: 'u1', notification_enabled: true });
    await waitFor(() => {
      expect(screen.getByText('settings.save')).toBeInTheDocument();
    });
  });

  it('updateProfile 成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveUpdate: (v: unknown) => void;
    mockUpdateProfile.mockImplementation(
      () => new Promise((resolve) => { resolveUpdate = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
    });
    unmount();
    resolveUpdate!({ id: 'u1', notification_enabled: false });
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
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
    });
    unmount();
    await act(async () => {
      rejectUpdate!(new Error('儲存失敗'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('updateProfile 成功應顯示 message.saveSuccess', async () => {
    mockUpdateProfile.mockResolvedValue({ id: 'u1', notification_enabled: false });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.saveSuccess');
    });
  });

  it('updateProfile 失敗且 message 為空字串時應使用 saveFail（F10 邊界）', async () => {
    mockUpdateProfile.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.saveFail');
    });
  });

  it('updateProfile 失敗後應仍可再次點擊儲存，成功後應顯示成功（F09 錯誤恢復：失敗不阻塞重試）', async () => {
    mockUpdateProfile
      .mockRejectedValueOnce({ code: 'UNKNOWN' })
      .mockResolvedValueOnce({ id: 'u1', notification_enabled: false });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.saveFail');
    });
    mockMessageError.mockClear();
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.saveSuccess');
    });
  });

  it('updateProfile 失敗且無 message 時應顯示 message.saveFail', async () => {
    mockUpdateProfile.mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.saveFail');
    });
  });

  it('updateProfile 失敗且有 message（非 FORBIDDEN）時應顯示該 message（F10 錯誤處理約定）', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('儲存失敗：網路連線逾時'));
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('儲存失敗：網路連線逾時');
    });
  });

  it('updateProfile FORBIDDEN 時若有 message 應顯示該 message（F08 權限邊界）', async () => {
    mockUpdateProfile.mockRejectedValue({ code: 'FORBIDDEN', message: '此帳號無法修改設定' });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此帳號無法修改設定');
    });
  });

  it('updateProfile FORBIDDEN 且無 message 時應使用 saveFail（F09 權限邊界 fallback）', async () => {
    mockUpdateProfile.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.saveFail');
    });
  });

  it('updateProfile 快速連點只會送出一次請求', async () => {
    let resolveUpdate: (v: unknown) => void;
    mockUpdateProfile.mockImplementation(
      () => new Promise((resolve) => { resolveUpdate = resolve; })
    );
    render(
      <MemoryRouter>
        <ProfileSettings />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('common.loading')).toBeNull());
    const saveBtn = screen.getByRole('button', { name: 'settings.save' });
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    });
    resolveUpdate!({ id: 'u1', notification_enabled: false });
    await waitFor(() => {
      expect(mockMessageError).not.toHaveBeenCalled();
    });
  });
});
