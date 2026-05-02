/**
 * Case Create 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CaseCreate from './index';
import { createCase, uploadEvidence } from '@/services/api/case';
import { validateStatement } from '@/utils/validate';

const mockNavigate = vi.fn();
const mockGetPairingStatus = vi.fn();
const mockMessageError = vi.fn();
const mockMessageWarning = vi.fn();
const mockMessageSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/api/pairing', () => ({
  getPairingStatus: (...args: unknown[]) => mockGetPairingStatus(...args),
}));

vi.mock('@/services/api/case', () => ({
  createCase: vi.fn(),
  uploadEvidence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/validate', () => ({
  validateStatement: vi.fn(),
}));

vi.mock('@/services/api/psychProfile', () => ({
  psychProfileApi: { getProfile: vi.fn().mockResolvedValue({ data: { data: null } }) },
}));

vi.mock('@/hooks/useInterviewTrigger', () => ({
  useInterviewTrigger: () => ({
    triggerInterview: vi.fn(),
    consentOpen: false,
    setConsentOpen: vi.fn(),
    setProfileConsent: vi.fn(),
    handleConsent: vi.fn(),
    consentLoading: false,
  }),
}));

vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <div data-testid="mediator-avatar" /> }));
vi.mock('@/components/business/FileUpload', () => ({
  default: ({ value = [], onChange }: { value?: unknown[]; onChange?: (files: unknown[]) => void }) => (
    <div>
      <div data-testid="file-upload" />
      <button
        type="button"
        data-testid="add-evidence"
        onClick={() => onChange?.([{ uid: '1', name: 'e.jpg', originFileObj: new File(['x'], 'e.jpg', { type: 'image/jpeg' }) }])}
      >
        add-evidence
      </button>
    </div>
  ),
}));
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      warning: (...args: unknown[]) => mockMessageWarning(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
    },
  };
});

const changeText = (element: HTMLElement, value: string) => {
  fireEvent.change(element, { target: { value } });
};

describe('Case Create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPairingStatus.mockResolvedValue({ id: 'pairing-1', status: 'active' });
    vi.mocked(validateStatement).mockReturnValue({ valid: false });
  });

  it('應顯示創建新案件標題', async () => {
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
  });

  it('應調用 getPairingStatus', async () => {
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalled();
    });
  });

  it('getPairingStatus 失敗時應顯示錯誤訊息與 retry、前往配對按鈕（F03 錯誤恢復）', async () => {
    mockGetPairingStatus.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('網絡錯誤')).toBeInTheDocument();
    });
    expect(screen.getByTestId('case-create-pairing-retry')).toBeInTheDocument();
    expect(screen.getByText('caseCreate.goPairing')).toBeInTheDocument();
  });

  it('應有創建案件頁面 role 與 aria-label', async () => {
    const { container } = render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      const main = container.querySelector('[role="main"][aria-label="caseCreate.pageLabel"]');
      expect(main).toBeInTheDocument();
    });
  });

  it('配對 pending 時應顯示配對未就緒', async () => {
    mockGetPairingStatus.mockResolvedValue({ id: 'pairing-1', status: 'pending' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.pairingRequired')).toBeInTheDocument();
    });
  });

  it('getPairingStatus 失敗時應顯示錯誤訊息（F03 錯誤反饋）', async () => {
    mockGetPairingStatus.mockRejectedValue(new Error('網路錯誤'));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('網路錯誤')).toBeInTheDocument();
    });
  });

  it('getPairingStatus 失敗時點擊 retry 應重新呼叫 getPairingStatus，成功後應顯示建立表單（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetPairingStatus
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockResolvedValueOnce({ id: 'pairing-retry', status: 'active' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('網絡錯誤')).toBeInTheDocument();
    });
    screen.getByTestId('case-create-pairing-retry').click();
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
  });

  it('getPairingStatus FORBIDDEN 且無 message 時應使用 getPairingFail（F03 權限邊界 fallback）', async () => {
    mockGetPairingStatus.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('message.getPairingFail')).toBeInTheDocument();
    });
    expect(screen.getByTestId('case-create-pairing-retry')).toBeInTheDocument();
    expect(screen.getByText('caseCreate.goPairing')).toBeInTheDocument();
  });

  it('getPairingStatus 失敗時點擊前往配對應導向 /profile/pairing（F03 錯誤恢復）', async () => {
    mockGetPairingStatus.mockRejectedValue(new Error('網路錯誤'));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    const goPairingBtn = await screen.findByText('caseCreate.goPairing');
    goPairingBtn.click();
    expect(mockNavigate).toHaveBeenCalledWith('/profile/pairing');
  });

  it('配對 pending 時點擊前往配對應導向 /profile/pairing', async () => {
    mockGetPairingStatus.mockResolvedValue({ id: 'pairing-1', status: 'pending' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    const goPairingBtn = await screen.findByText('caseCreate.goPairing');
    goPairingBtn.click();
    expect(mockNavigate).toHaveBeenCalledWith('/profile/pairing');
  });

  it('配對 active 時應顯示表單且提交按鈕初始為 disabled', async () => {
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const submitBtn = screen.getByRole('button', { name: 'caseCreate.submitBtn' });
    expect(submitBtn).toBeDisabled();
  });

  it('表單填妥提交成功後應導向 /case/:id', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockResolvedValue({ id: 'new-case-123' } as Awaited<ReturnType<typeof createCase>>);
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    const plaintiffInput = textboxes[0];
    changeText(plaintiffInput, '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(createCase).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/case/new-case-123');
    });
  });

  it('checkPairing 成功但組件已卸載時不應 setState（useMountedRef 回歸：F03-OPT-004）', async () => {
    let resolvePairing: (v: unknown) => void;
    mockGetPairingStatus.mockImplementation(
      () => new Promise((resolve) => { resolvePairing = resolve; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalled();
    });
    unmount();
    resolvePairing!({ id: 'pairing-1', status: 'active' });
    await Promise.resolve();
    await Promise.resolve();
  });

  it('checkPairing 失敗但組件已卸載時不應 setState（useMountedRef 回歸：F03-OPT-004）', async () => {
    let rejectPairing: (v: unknown) => void;
    mockGetPairingStatus.mockImplementation(
      () => new Promise((_, reject) => { rejectPairing = reject; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetPairingStatus).toHaveBeenCalled();
    });
    unmount();
    rejectPairing!({ code: 'NETWORK_ERROR' });
    await Promise.resolve();
    await Promise.resolve();
  });

  it('createCase 成功但組件已卸載時不應呼叫 message.success 或 navigate（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    let resolveCreate: (v: unknown) => void;
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; }) as ReturnType<typeof createCase>
    );
    const { unmount } = render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(createCase).toHaveBeenCalled();
    });
    unmount();
    resolveCreate!({ id: 'new-case-123' });
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('createCase 快速連點只會送出一次請求', async () => {
    let resolveCreate: (v: unknown) => void;
    const createPromise = new Promise((resolve) => { resolveCreate = resolve; });
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockImplementation(() => createPromise as ReturnType<typeof createCase>);
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    const submitBtn = screen.getByRole('button', { name: 'caseCreate.submitBtn' });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(createCase).toHaveBeenCalledTimes(1);
    });
    resolveCreate!({ id: 'new-case-123' });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/case/new-case-123');
    });
  });

  it('createCase 失敗且錯誤無 message 時應顯示 message.createCaseFail', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockRejectedValue({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.createCaseFail');
    });
  });

  it('createCase 失敗且 message 為空字串時應使用 message.createCaseFail（F10 邊界）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.createCaseFail');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/case/'));
  });

  it('createCase 失敗且有 message（非 FORBIDDEN）時應顯示該 message（F10 錯誤處理約定）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockRejectedValue(new Error('陳述內容含敏感詞彙，請修正後再試'));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('陳述內容含敏感詞彙，請修正後再試');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/case/'));
  });

  it('createCase 失敗時應顯示頁內錯誤與 retry，retry 成功後應導向案件詳情', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase)
      .mockRejectedValueOnce(new Error('暫時無法建立'))
      .mockResolvedValueOnce({ id: 'retry-inline-case' } as Awaited<ReturnType<typeof createCase>>);
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    changeText(screen.getAllByRole('textbox')[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    expect(await screen.findByText('暫時無法建立')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    await waitFor(() => {
      expect(createCase).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('/case/retry-inline-case');
    });
  });

  it('createCase 失敗後修改輸入時應清除頁內錯誤', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockRejectedValueOnce(new Error('暫時無法建立'));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const plaintiffInput = screen.getByPlaceholderText('caseCreate.plaintiffPlaceholder');
    changeText(plaintiffInput, '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    expect(await screen.findByText('暫時無法建立')).toBeInTheDocument();
    changeText(plaintiffInput, '原告陳述內容至少一字觸發驗證補充');
    await waitFor(() => {
      expect(screen.queryByText('暫時無法建立')).not.toBeInTheDocument();
    });
  });

  it('createCase 失敗後應仍可重新提交，表單不鎖死（F03 錯誤恢復：失敗不阻塞重試）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase)
      .mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '暫時無法建立' })
      .mockResolvedValueOnce({ id: 'retry-case-456' } as Awaited<ReturnType<typeof createCase>>);
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法建立');
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(createCase).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('/case/retry-case-456');
    });
  });

  it('createCase FORBIDDEN 時若有 message 應顯示該 message（F03 權限邊界）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockRejectedValue({ code: 'FORBIDDEN', message: '配對已達案件上限' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('配對已達案件上限');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/case/'));
  });

  it('createCase FORBIDDEN 且無 message 時應使用 createCaseFail（F03 權限邊界 fallback）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    changeText(screen.getAllByRole('textbox')[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.createCaseFail');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/case/'));
  });

  it('無證據時提交，createCase 成功後不應調用 uploadEvidence（F03 證據邊界）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockResolvedValue({ id: 'new-case-no-ev' } as Awaited<ReturnType<typeof createCase>>);
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    changeText(screen.getAllByRole('textbox')[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(createCase).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/case/new-case-no-ev');
    });
    expect(uploadEvidence).not.toHaveBeenCalled();
  });

  it('createCase 成功但證據上傳失敗時應顯示 warning 且仍導向案件詳情', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockResolvedValue({ id: 'new-case-456' } as Awaited<ReturnType<typeof createCase>>);
    vi.mocked(uploadEvidence).mockRejectedValueOnce(new Error('upload failed'));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('add-evidence'));
    changeText(screen.getAllByRole('textbox')[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('caseCreate.remoteCreateSuccess');
      expect(mockMessageWarning).toHaveBeenCalledWith('upload failed');
      expect(mockNavigate).toHaveBeenCalledWith('/case/new-case-456');
    });
  });

  it('createCase 成功但證據上傳 FORBIDDEN 時若有 message 應顯示該 message（F03 權限邊界）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockResolvedValue({ id: 'new-case-fb' } as Awaited<ReturnType<typeof createCase>>);
    vi.mocked(uploadEvidence).mockRejectedValueOnce({ code: 'FORBIDDEN', message: '檔案類型不允許' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('add-evidence'));
    changeText(screen.getAllByRole('textbox')[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('檔案類型不允許');
      expect(mockNavigate).toHaveBeenCalledWith('/case/new-case-fb');
    });
  });

  it('createCase 成功但證據上傳 FORBIDDEN 且無 message 時應使用 evidenceUploadFailCaseCreated（F03 權限邊界 fallback）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockResolvedValue({ id: 'new-case-forbidden' } as Awaited<ReturnType<typeof createCase>>);
    vi.mocked(uploadEvidence).mockRejectedValueOnce({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('add-evidence'));
    changeText(screen.getAllByRole('textbox')[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.evidenceUploadFailCaseCreated');
      expect(mockNavigate).toHaveBeenCalledWith('/case/new-case-forbidden');
    });
  });

  it('createCase 成功但證據上傳失敗且錯誤無 message 時應使用 evidenceUploadFailCaseCreated', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockResolvedValue({ id: 'new-case-789' } as Awaited<ReturnType<typeof createCase>>);
    vi.mocked(uploadEvidence).mockRejectedValueOnce({ code: 'SERVER_ERROR' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('add-evidence'));
    changeText(screen.getAllByRole('textbox')[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.evidenceUploadFailCaseCreated');
      expect(mockNavigate).toHaveBeenCalledWith('/case/new-case-789');
    });
  });

  it('createCase 成功但證據上傳失敗且 message 為空字串時應使用 evidenceUploadFailCaseCreated（F10 邊界）', async () => {
    vi.mocked(validateStatement).mockReturnValue({ valid: true });
    vi.mocked(createCase).mockResolvedValue({ id: 'new-case-empty-msg' } as Awaited<ReturnType<typeof createCase>>);
    vi.mocked(uploadEvidence).mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('add-evidence'));
    changeText(screen.getAllByRole('textbox')[0], '原告陳述內容至少一字觸發驗證');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.evidenceUploadFailCaseCreated');
      expect(mockNavigate).toHaveBeenCalledWith('/case/new-case-empty-msg');
    });
  });

  it('remote 模式下原告不足 30 字時提交按鈕應 disabled（邊界：validateStatement 30 字規則）', async () => {
    vi.mocked(validateStatement).mockImplementation((s: string) => ({
      valid: (s?.trim?.() ?? '').length >= 30,
    }));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[1], 'a'.repeat(29)); // plaintiff
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).toBeDisabled();
    });
  });

  it('remote 模式下原告剛好 30 字時提交按鈕應 enabled（正邊界：validateStatement 30 字規則）', async () => {
    vi.mocked(validateStatement).mockImplementation((s: string) => ({
      valid: (s?.trim?.() ?? '').length >= 30,
    }));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[1], 'a'.repeat(30)); // plaintiff exactly 30
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
  });

  it('collaborative 模式下原告 exactly 29 字時提交按鈕應 disabled', async () => {
    vi.mocked(validateStatement).mockImplementation((s: string) => ({
      valid: (s?.trim?.() ?? '').length >= 30,
    }));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]); // collaborative
    const textboxes = screen.getAllByRole('textbox');
    changeText(textboxes[1], 'a'.repeat(29));
    changeText(textboxes[2], 'a'.repeat(30)); // defendant 足
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).toBeDisabled();
    });
  });

  it('collaborative 模式下只有原告陳述時提交按鈕應 disabled', async () => {
    vi.mocked(validateStatement).mockImplementation((s: string) => ({
      valid: (s?.trim?.()?.length ?? 0) >= 30,
    }));
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]); // collaborative 為第二個選項
    const textboxes = screen.getAllByRole('textbox');
    const plaintiffInput = textboxes[1]; // [0]=title, [1]=plaintiff, [2]=defendant
    changeText(plaintiffInput, 'a'.repeat(30));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).toBeDisabled();
    });
  });

  it('collaborative 模式下雙方陳述都填妥時可提交並成功建案', async () => {
    vi.mocked(validateStatement).mockImplementation((s: string) => ({
      valid: (s?.trim?.()?.length ?? 0) >= 30,
    }));
    vi.mocked(createCase).mockResolvedValue({ id: 'collab-case-1' } as Awaited<ReturnType<typeof createCase>>);
    render(
      <MemoryRouter>
        <CaseCreate />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('caseCreate.heading')).toBeInTheDocument();
    });
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]); // collaborative 為第二個選項
    const textboxes = screen.getAllByRole('textbox');
    // textboxes[0]=標題, [1]=原告陳述, [2]=被告陳述；validateStatement 需至少 30 字
    const validStatement = 'a'.repeat(30);
    changeText(textboxes[1], validStatement);
    changeText(textboxes[2], validStatement);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'caseCreate.submitBtn' })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'caseCreate.submitBtn' }));
    await waitFor(() => {
      expect(createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'collaborative',
          plaintiff_statement: validStatement,
          defendant_statement: validStatement,
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/case/collab-case-1');
    });
  });
});
