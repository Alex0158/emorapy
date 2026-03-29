/**
 * Execution CheckIn 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetExecutionStatus = vi.fn();
const mockCheckin = vi.fn();
const mockUploadEvidence = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();
const mockMessageWarning = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/services/api/execution', () => ({
  checkin: (...args: unknown[]) => mockCheckin(...args),
  getExecutionStatus: (...args: unknown[]) => mockGetExecutionStatus(...args),
}));
vi.mock('@/services/api/case', () => ({
  uploadEvidence: (...args: unknown[]) => mockUploadEvidence(...args),
}));
const mockGetPlanById = vi.fn();
vi.mock('@/services/api/reconciliation', () => ({
  getPlanById: (...args: unknown[]) => mockGetPlanById(...args),
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: {
      error: (...args: unknown[]) => mockMessageError(...args),
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      warning: (...args: unknown[]) => mockMessageWarning(...args),
      info: vi.fn(),
    },
  };
});

import ExecutionCheckIn from './index';

const mockExecution = {
  plan_id: 'plan-1',
  status: 'in_progress',
  progress: 50,
  records: [
    { id: 'r1', notes: '第一次打卡', created_at: '2025-01-01T00:00:00Z', photos: [] },
  ],
};

function renderPage(planId = 'plan-1') {
  return render(
    <MemoryRouter initialEntries={[`/execution/${planId}/checkin`]}>
      <Routes>
        <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ExecutionCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('掛載時應呼叫 getExecutionStatus', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    renderPage();
    await waitFor(() => {
      expect(mockGetExecutionStatus).toHaveBeenCalledWith('plan-1');
    });
  });

  it('loading 時應顯示 Spin', () => {
    mockGetExecutionStatus.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('getExecutionStatus 失敗應顯示 notFound Alert', async () => {
    mockGetExecutionStatus.mockRejectedValue(new Error('取得失敗'));
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('取得失敗');
    });
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.notFound')).toBeInTheDocument();
    });
  });

  it('getExecutionStatus 失敗且無 message 時應使用 getExecutionStatusFail', async () => {
    mockGetExecutionStatus.mockRejectedValue({ code: 'UNKNOWN' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getExecutionStatusFail');
    });
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.notFound')).toBeInTheDocument();
    });
  });

  it('getExecutionStatus 失敗且 message 為空字串時應使用 getExecutionStatusFail（F10 邊界）', async () => {
    mockGetExecutionStatus.mockRejectedValue({ code: 'UNKNOWN', message: '' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getExecutionStatusFail');
    });
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.notFound')).toBeInTheDocument();
    });
  });

  it('getExecutionStatus FORBIDDEN 且無 message 時應使用 getExecutionStatusFail（F05 權限邊界 fallback）', async () => {
    mockGetExecutionStatus.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getExecutionStatusFail');
    });
  });

  it('getExecutionStatus FORBIDDEN 時若有 message 應顯示該 message（F05 權限邊界）', async () => {
    mockGetExecutionStatus.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限查看此執行進度' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('無權限查看此執行進度');
    });
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.notFound')).toBeInTheDocument();
    });
  });

  it('getExecutionStatus 失敗時應仍可點擊 retry 或前往執行看板導向 /execution/dashboard（F05 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetExecutionStatus.mockRejectedValue(new Error('網絡錯誤'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    const backBtn = screen.getByText('execCheckIn.backToDashboard');
    expect(backBtn).toBeInTheDocument();
    await userEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/execution/dashboard');
  });

  it('getExecutionStatus 失敗時點擊 retry 應重新呼叫 getExecutionStatus', async () => {
    mockGetExecutionStatus
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockResolvedValueOnce(mockExecution);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(2);
    });
  });

  it('getExecutionStatus 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示執行進度（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetExecutionStatus
      .mockRejectedValueOnce(new Error('第一次失敗'))
      .mockRejectedValueOnce(new Error('第二次仍失敗'))
      .mockResolvedValueOnce(mockExecution);
    renderPage();
    await waitFor(() => expect(screen.getByText('common.retry')).toBeInTheDocument());
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => expect(mockMessageError).toHaveBeenCalledWith('第二次仍失敗'));
    await waitFor(() => expect(screen.getByText('common.retry')).toBeInTheDocument());
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(3);
      expect(screen.getByText('execCheckIn.heading')).toBeInTheDocument();
    });
  });

  it('getExecutionStatus 失敗時 retry 再次失敗應顯示該次錯誤訊息（F05 重試錯誤反饋）', async () => {
    mockGetExecutionStatus.mockRejectedValue(new Error('取得失敗'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetExecutionStatus).toHaveBeenCalledTimes(1);
    mockGetExecutionStatus.mockRejectedValueOnce(new Error('重試時服務不可用'));
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('重試時服務不可用');
    });
  });

  it('getExecutionStatus 失敗時 retry 再次失敗且 message 為空字串應使用 getExecutionStatusFail（F10 邊界）', async () => {
    mockGetExecutionStatus.mockRejectedValue(new Error('取得失敗'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockGetExecutionStatus.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getExecutionStatusFail');
    });
  });

  it('getExecutionStatus 失敗時 retry 快速連點只會送出一次 getExecutionStatus 請求（F05 重試節流）', async () => {
    let resolveFetch: (v: unknown) => void;
    mockGetExecutionStatus
      .mockRejectedValueOnce(new Error('網絡錯誤'))
      .mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetExecutionStatus).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByText('common.retry');
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(2);
    });
    resolveFetch!(mockExecution);
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.heading')).toBeInTheDocument();
    });
  });

  it('execution 載入成功應顯示進度和表單', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.heading')).toBeInTheDocument();
    });
    expect(screen.getByText('execCheckIn.notesLabel')).toBeInTheDocument();
    expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
  });

  it('有歷史紀錄時應顯示紀錄列表', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.historyTitle')).toBeInTheDocument();
    });
    expect(screen.getByText('第一次打卡')).toBeInTheDocument();
  });

  it('無歷史紀錄時不應顯示紀錄區塊', async () => {
    mockGetExecutionStatus.mockResolvedValue({ ...mockExecution, records: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.heading')).toBeInTheDocument();
    });
    expect(screen.queryByText('execCheckIn.historyTitle')).not.toBeInTheDocument();
  });

  it('execution.records 為 null 或非陣列時應不崩潰並顯示進度與表單（F05-BUG-007 組件層防禦）', async () => {
    mockGetExecutionStatus.mockResolvedValue({ ...mockExecution, records: null });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.heading')).toBeInTheDocument();
    });
    expect(screen.getByText('execCheckIn.notesLabel')).toBeInTheDocument();
    expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    expect(screen.queryByText('execCheckIn.historyTitle')).not.toBeInTheDocument();
  });

  it('打卡提交失敗且無 message 時應使用 message.checkinFail', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockRejectedValue({ code: 'SERVER_ERROR' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.checkinFail');
    });
  });

  it('checkin FORBIDDEN 且無 message 時應使用 checkinFail（F05 權限邊界 fallback）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockRejectedValue({ code: 'FORBIDDEN' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.checkinFail');
    });
  });

  it('checkin FORBIDDEN 時若有 message 應顯示該 message（F05 權限邊界）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockRejectedValue({ code: 'FORBIDDEN', message: '此方案已無法打卡' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('此方案已無法打卡');
    });
  });

  it('checkin 失敗且有 message（非 FORBIDDEN）時應顯示該 message（F10 錯誤處理約定）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockRejectedValue(new Error('今日已達打卡上限，明日再試'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('今日已達打卡上限，明日再試');
    });
  });

  it('checkin 失敗且 message 為空字串時應使用 checkinFail（F10 邊界）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.checkinFail');
    });
  });

  it('打卡失敗後應仍可再次點擊打卡，成功後應顯示成功（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin
      .mockRejectedValueOnce(new Error('暫時無法打卡'))
      .mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法打卡');
    });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(
      () => {
        expect(mockCheckin).toHaveBeenCalledTimes(2);
        expect(mockMessageSuccess).toHaveBeenCalledWith('message.checkinSuccess');
      },
      { timeout: 5000 }
    );
  });

  it('打卡成功後 refresh 失敗應保留 execution 並顯示 refreshFail，不顯示 notFound（F05-BUG-002）', async () => {
    mockGetExecutionStatus
      .mockResolvedValueOnce(mockExecution)
      .mockRejectedValueOnce(new Error('網絡錯誤'));
    mockCheckin.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: 'plan-1', notes: '今日進度良好', photos: [] })
      );
    });
    await waitFor(
      () => {
        expect(mockMessageSuccess).toHaveBeenCalledWith('message.checkinSuccess');
      },
      { timeout: 5000 }
    );
    await waitFor(
      () => {
        expect(mockGetExecutionStatus).toHaveBeenCalledTimes(2);
      },
      { timeout: 5000 }
    );
    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('execCheckIn.refreshFail');
    });
    expect(screen.getByText('execCheckIn.heading')).toBeInTheDocument();
    expect(screen.queryByText('execCheckIn.notFound')).not.toBeInTheDocument();
  }, 15000);

  it('無照片時打卡成功應顯示 checkinSuccess 並於 2 秒後重新拉取 execution', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: 'plan-1', notes: '今日進度良好', photos: [] })
      );
    });
    expect(mockGetExecutionStatus).toHaveBeenCalledTimes(1);
    await waitFor(
      () => {
        expect(mockMessageSuccess).toHaveBeenCalledWith('message.checkinSuccess');
      },
      { timeout: 5000 }
    );
    await waitFor(() => {
      expect(mockGetExecutionStatus).toHaveBeenCalledTimes(2);
    });
  }, 15000);

  it('打卡成功但組件已卸載時不應呼叫 message.success（useMountedRef 回歸：避免 F01-BUG-001 同類問題）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    let resolveCheckin: () => void;
    mockCheckin.mockImplementation(
      () => new Promise<void>((resolve) => { resolveCheckin = resolve; })
    );
    const { unmount } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalled();
    });
    unmount();
    resolveCheckin!();
    await Promise.resolve();
    expect(mockMessageSuccess).not.toHaveBeenCalled();
  }, 5000);

  it('無照片時打卡，不應調用 uploadEvidence（F05 照片邊界：與 Case Create 無證據不調用對齊）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度' } });
    fireEvent.click(screen.getByRole('button', { name: 'execCheckIn.submit' }));
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: 'plan-1', notes: '今日進度', photos: [] })
      );
    });
    expect(mockUploadEvidence).not.toHaveBeenCalled();
  }, 5000);

  it('有照片時上傳成功應將 photoUrls 傳給 checkin（三段鏈路 happy path）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence.mockResolvedValue([
      { id: 'e1', file_url: 'https://example.com/photo1.jpg' },
    ]);
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledWith('plan-1');
      expect(mockUploadEvidence).toHaveBeenCalledWith('case-1', expect.any(Array));
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: ['https://example.com/photo1.jpg'],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('有照片時 getPlanById 回傳 null 應顯示 photoUploadFailContinue 且以空 photos 繼續打卡（F05 邊界：plan 不存在時不崩潰）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue(null);
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.photoUploadFailContinue');
    }, { timeout: 5000 });
    expect(mockUploadEvidence).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: [],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('有照片時 uploadEvidence 回傳空陣列應以空 photos 繼續打卡且顯示成功（F05 邊界：API 回傳空陣列時不崩潰）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence.mockResolvedValue([]);
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockUploadEvidence).toHaveBeenCalled();
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度',
          photos: [],
        })
      );
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.checkinSuccess');
    }, { timeout: 5000 });
  }, 15000);

  it('有照片時 getPlanById 成功但 plan 無 judgment.case_id 應顯示 warning 且以空 photos 提交', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({ id: 'plan-1', judgment: null });
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.photoUploadFailContinue');
    }, { timeout: 5000 });
    expect(mockUploadEvidence).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: [],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('有照片時 getPlanById 失敗且有 message 應顯示該 message 且繼續打卡（以空 photos 提交）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockRejectedValue(new Error('plan fetch failed'));
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('plan fetch failed');
    }, { timeout: 5000 });
    expect(mockUploadEvidence).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: [],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('有照片時 getPlanById 失敗且無 message 應顯示 photoUploadFailContinue 且繼續打卡', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockRejectedValue({ code: 'SERVER_ERROR' });
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.photoUploadFailContinue');
    }, { timeout: 5000 });
    expect(mockUploadEvidence).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: [],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('有照片時上傳成功應將 photoUrls 傳給 checkin（F05 多張照片三段鏈路）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence.mockResolvedValue([
      { file_url: 'https://example.com/photo1.jpg' },
      { file_url: 'https://example.com/photo2.jpg' },
    ]);
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [
        { uid: '1', name: 'photo1.jpg', originFileObj: new File([], 'photo1.jpg') },
        { uid: '2', name: 'photo2.jpg', originFileObj: new File([], 'photo2.jpg') },
      ],
    });
    form.submit();

    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledWith('plan-1');
      expect(mockUploadEvidence).toHaveBeenCalledWith('case-1', expect.any(Array));
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('照片上傳成功但 checkin 失敗後應仍可再次點擊打卡，成功後應顯示成功（F05 錯誤恢復：checkin 失敗不阻塞重試）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence.mockResolvedValue([{ id: 'e1', file_url: 'https://example.com/photo1.jpg' }]);
    mockCheckin
      .mockRejectedValueOnce(new Error('暫時無法打卡'))
      .mockResolvedValueOnce(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法打卡');
    });
    expect(mockUploadEvidence).toHaveBeenCalledTimes(1);
    expect(mockCheckin).toHaveBeenCalledTimes(1);
    expect(mockCheckin).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan-1',
        notes: '今日進度良好',
        photos: ['https://example.com/photo1.jpg'],
      })
    );

    form.submit();

    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockMessageSuccess).toHaveBeenCalledWith('message.checkinSuccess');
    }, { timeout: 5000 });
  }, 15000);

  it('有照片時 uploadEvidence FORBIDDEN 且無 message 應使用 photoUploadFailContinue 並以空 photos 繼續打卡（F05 權限邊界 fallback）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence.mockRejectedValue({ code: 'FORBIDDEN' });
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.photoUploadFailContinue');
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: [],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('照片上傳失敗且 message 為空字串應使用 photoUploadFailContinue 並繼續打卡（F10 邊界）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.photoUploadFailContinue');
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: [],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('照片上傳失敗且有 message 應顯示該 message 並繼續打卡（F05 錯誤處理約定）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence.mockRejectedValue(new Error('upload failed'));
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('upload failed');
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: [],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('照片上傳失敗且 checkin 失敗後應仍可再次點擊打卡，第二次上傳成功時應將 photoUrls 傳給 checkin 並顯示成功（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence
      .mockRejectedValueOnce(new Error('網路中斷'))
      .mockResolvedValueOnce([{ id: 'e1', file_url: 'https://example.com/photo1.jpg' }]);
    mockCheckin
      .mockRejectedValueOnce(new Error('暫時無法打卡'))
      .mockResolvedValueOnce(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('網路中斷');
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('暫時無法打卡');
    });
    expect(mockUploadEvidence).toHaveBeenCalledTimes(1);
    expect(mockCheckin).toHaveBeenCalledTimes(1);
    expect(mockCheckin).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan-1',
        notes: '今日進度良好',
        photos: [],
      })
    );

    mockMessageError.mockClear();
    mockMessageWarning.mockClear();
    form.submit();

    await waitFor(() => {
      expect(mockUploadEvidence).toHaveBeenCalledTimes(2);
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: ['https://example.com/photo1.jpg'],
        })
      );
    }, { timeout: 5000 });
    await waitFor(
      () => {
        expect(mockMessageSuccess).toHaveBeenCalledWith('message.checkinSuccess');
      },
      { timeout: 5000 }
    );
  }, 15000);

  it('照片上傳失敗且無 message 應顯示 photoUploadFailContinue 並繼續打卡', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({
      id: 'plan-1',
      judgment: { case_id: 'case-1' },
    });
    mockUploadEvidence.mockRejectedValue({ code: 'SERVER_ERROR' });
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();

    await waitFor(() => {
      expect(mockMessageWarning).toHaveBeenCalledWith('message.photoUploadFailContinue');
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_id: 'plan-1',
          notes: '今日進度良好',
          photos: [],
        })
      );
    }, { timeout: 5000 });
  }, 15000);

  it('有照片時打卡快速連點只會送出一次 checkin 請求（F05 提交節流）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockGetPlanById.mockResolvedValue({ id: 'plan-1', judgment: { case_id: 'case-1' } });
    mockUploadEvidence.mockResolvedValue([
      { id: 'e1', file_url: 'https://example.com/p.jpg', file_type: 'image' },
    ]);
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    }, { timeout: 5000 });
    const form = formRef.current!;
    form.setFieldsValue({
      notes: '今日進度良好',
      photos: [{ uid: '1', name: 'photo.jpg', originFileObj: new File([], 'photo.jpg') }],
    });
    form.submit();
    form.submit();
    form.submit();

    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledTimes(1);
    });
    await waitFor(
      () => {
        expect(mockMessageSuccess).toHaveBeenCalledWith('message.checkinSuccess');
      },
      { timeout: 5000 }
    );
  }, 15000);

  it('打卡快速連點只會送出一次 checkin 請求', async () => {
    let resolveCheckin: (v: unknown) => void;
    const checkinPromise = new Promise((resolve) => { resolveCheckin = resolve; });
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockImplementation(() => checkinPromise);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('execCheckIn.submit')).toBeInTheDocument();
    });
    const notesInput = screen.getByPlaceholderText('execCheckIn.notesPlaceholder');
    fireEvent.change(notesInput, { target: { value: '今日進度良好' } });

    const submitBtn = screen.getByRole('button', { name: 'execCheckIn.submit' });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledTimes(1);
    });
    resolveCheckin!(undefined);
    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledTimes(1);
    });
    // 成功訊息在 setTimeout 2s 後顯示，此測試重點為連點防護，不等待
  });

  it('打卡成功後在 2 秒成功動畫期間不應再次提交，動畫結束後才可再次打卡（P1-05）', async () => {
    mockGetExecutionStatus.mockResolvedValue(mockExecution);
    mockCheckin.mockResolvedValue(undefined);

    const formRef = { current: null as ReturnType<typeof import('antd').Form.useForm>[0] | null };
    render(
      <MemoryRouter initialEntries={['/execution/plan-1/checkin']}>
        <Routes>
          <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn formRef={formRef} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(formRef.current).not.toBeNull();
    });
    const form = formRef.current!;
    vi.useFakeTimers();
    act(() => {
      form.setFieldsValue({ notes: '第一次打卡' });
      form.submit();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCheckin).toHaveBeenCalledTimes(1);

    act(() => {
      form.setFieldsValue({ notes: '成功動畫期間再次點擊' });
      form.submit();
    });
    await Promise.resolve();
    expect(mockCheckin).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    act(() => {
      form.setFieldsValue({ notes: '動畫結束後第二次打卡' });
      form.submit();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCheckin).toHaveBeenCalledTimes(2);
    expect(mockCheckin).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plan_id: 'plan-1',
        notes: '動畫結束後第二次打卡',
        photos: [],
      })
    );
    vi.useRealTimers();
  });
});
