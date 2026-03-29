/**
 * Execution Dashboard 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExecutionDashboard from './index';

const { mockNavigate, mockGetAllExecutionStatuses, mockMessageError } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetAllExecutionStatuses: vi.fn(),
  mockMessageError: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/api/execution', () => ({
  getAllExecutionStatuses: (...args: unknown[]) => mockGetAllExecutionStatuses(...args),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="protected">{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({
  default: () => null,
}));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="animated">{children}</div>,
}));
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>();
  return {
    ...antd,
    message: { ...antd.message, error: mockMessageError },
  };
});

describe('ExecutionDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('載入中應顯示 Spin', () => {
    mockGetAllExecutionStatuses.mockImplementation(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('無資料時應顯示空狀態與前往案件列表按鈕', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('execDashboard.empty')).toBeInTheDocument();
    });
    const btn = screen.getByText('execDashboard.goCaseList');
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/case/list');
  });

  it('execution 的 plan_summary 為空物件 {} 時應不崩潰並使用 planFallbackTitle 顯示標題（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    const executions = [
      {
        plan_id: 'plan-empty-summary',
        status: 'in_progress',
        records: [],
        progress: 30,
        plan_summary: {},
      },
    ];
    mockGetAllExecutionStatuses.mockResolvedValue(executions);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('execDashboard.heading')).toBeInTheDocument();
    });
    expect(screen.getByText(/plan-empty-summary|planFallbackTitle/)).toBeInTheDocument();
    const checkinBtn = screen.getByText('execDashboard.checkIn');
    await userEvent.click(checkinBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-empty-summary/checkin');
  });

  it('execution 的 plan_summary 為 null 時應使用 planFallbackTitle 顯示標題（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    const executions = [
      {
        plan_id: 'plan-no-summary',
        status: 'in_progress',
        records: [],
        progress: 30,
        plan_summary: null,
      },
    ];
    mockGetAllExecutionStatuses.mockResolvedValue(executions);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('execDashboard.heading')).toBeInTheDocument();
    });
    expect(screen.getByText(/plan-no-summary|planFallbackTitle/)).toBeInTheDocument();
    const checkinBtn = screen.getByText('execDashboard.checkIn');
    await userEvent.click(checkinBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-no-summary/checkin');
  });

  it('execution 的 status 為 undefined 時應不崩潰，該項不顯示於進行中或已完成區塊（F05 邊界：API 回傳不完整時防禦）', async () => {
    const executions = [
      {
        plan_id: 'plan-unknown-status',
        status: undefined as unknown as string,
        records: [],
        progress: 50,
        plan_summary: { title: '方案 X', plan_type: 'activity', difficulty_level: 'easy' },
      },
    ];
    mockGetAllExecutionStatuses.mockResolvedValue(executions);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('execDashboard.heading')).toBeInTheDocument();
    });
    expect(screen.queryByText('execDashboard.inProgress')).not.toBeInTheDocument();
    expect(screen.queryByText('execDashboard.completed')).not.toBeInTheDocument();
  });

  it('execution 的 plan_summary 為非物件（如字串）時應不崩潰並使用 planFallbackTitle（F05 邊界：API 回傳不完整時防禦）', async () => {
    const executions = [
      {
        plan_id: 'plan-bad-summary',
        status: 'in_progress',
        records: [],
        progress: 30,
        plan_summary: 'invalid' as unknown as Record<string, unknown>,
      },
    ];
    mockGetAllExecutionStatuses.mockResolvedValue(executions);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('execDashboard.heading')).toBeInTheDocument();
    });
    expect(screen.getByText(/plan-bad-summary|planFallbackTitle/)).toBeInTheDocument();
  });

  it('getAllExecutionStatuses 回傳 undefined 時應不崩潰並顯示空狀態（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('execDashboard.empty')).toBeInTheDocument();
    });
  });

  it('getAllExecutionStatuses 回傳非陣列時應不崩潰並顯示空狀態（F05 邊界：API 回傳不完整時不崩潰）', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue({ executions: [] } as unknown);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('execDashboard.empty')).toBeInTheDocument();
    });
  });

  it('有進行中與已完成時應顯示對應區塊與卡片', async () => {
    const executions = [
      {
        plan_id: 'plan-1',
        status: 'in_progress',
        records: [],
        progress: 50,
        plan_summary: { title: '方案 A', plan_type: 'activity', difficulty_level: 'easy', estimated_duration: 7 },
      },
      {
        plan_id: 'plan-2',
        status: 'completed',
        records: [],
        progress: 100,
        plan_summary: { title: '方案 B', plan_type: 'communication', difficulty_level: 'medium' },
      },
    ];
    mockGetAllExecutionStatuses.mockResolvedValue(executions);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('execDashboard.heading')).toBeInTheDocument();
    });
    expect(screen.getByText('execDashboard.inProgress')).toBeInTheDocument();
    expect(screen.getByText('execDashboard.completed')).toBeInTheDocument();
    expect(screen.getByText('方案 A')).toBeInTheDocument();
    expect(screen.getByText('方案 B')).toBeInTheDocument();
    const checkinBtn = screen.getByText('execDashboard.checkIn');
    expect(checkinBtn).toBeInTheDocument();
    await userEvent.click(checkinBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-1/checkin');
  });

  it('API 失敗時應顯示錯誤訊息與 retry 按鈕', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    });
    await waitFor(() => {
      expect(screen.getByText('網絡錯誤')).toBeInTheDocument();
    });
    expect(screen.getByText('common.retry')).toBeInTheDocument();
    expect(screen.getByText('common.back')).toBeInTheDocument();
    expect(screen.getByText('execDashboard.goCaseList')).toBeInTheDocument();
  });

  it('初次載入失敗但組件已卸載時不應呼叫 message.error（mounted 回歸：避免卸載後誤提示）', async () => {
    let rejectFetch: (reason?: unknown) => void;
    mockGetAllExecutionStatuses.mockImplementation(
      () => new Promise((_, reject) => { rejectFetch = reject; })
    );
    const { unmount } = render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(1);
    });
    unmount();
    await act(async () => {
      rejectFetch!(new Error('網絡錯誤'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('API 失敗且無 message 時應使用 getExecutionStatusFail', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue({ code: 'UNKNOWN' });
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getExecutionStatusFail');
    });
    await waitFor(() => {
      expect(screen.getByText('message.getExecutionStatusFail')).toBeInTheDocument();
    });
    expect(screen.getByText('common.retry')).toBeInTheDocument();
  });

  it('API 失敗且 message 為空字串時應使用 getExecutionStatusFail（F10 邊界：空 message 視為無）', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue({ code: 'SERVER_ERROR', message: '' });
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getExecutionStatusFail');
    });
    await waitFor(() => {
      expect(screen.getByText('message.getExecutionStatusFail')).toBeInTheDocument();
    });
    expect(screen.getByText('common.retry')).toBeInTheDocument();
  });

  it('getAllExecutionStatuses FORBIDDEN 且無 message 時應使用 getExecutionStatusFail（F05 權限邊界 fallback）', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue({ code: 'FORBIDDEN' });
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.getExecutionStatusFail');
    });
    await waitFor(() => {
      expect(screen.getByText('message.getExecutionStatusFail')).toBeInTheDocument();
    });
    expect(screen.getByText('common.retry')).toBeInTheDocument();
  });

  it('getAllExecutionStatuses FORBIDDEN 時若有 message 應顯示該 message（F05 權限邊界）', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue({ code: 'FORBIDDEN', message: '無權限查看執行狀態' });
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('無權限查看執行狀態');
    });
    await waitFor(() => {
      expect(screen.getByText('無權限查看執行狀態')).toBeInTheDocument();
    });
    expect(screen.getByText('common.retry')).toBeInTheDocument();
  });

  it('getAllExecutionStatuses 失敗時應仍可點擊前往案件列表按鈕並導向 /case/list（F05 錯誤恢復：失敗不阻塞導航出口）', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    const goCaseListBtn = screen.getByText('execDashboard.goCaseList');
    expect(goCaseListBtn).toBeInTheDocument();
    await userEvent.click(goCaseListBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/case/list');
  });

  it('getAllExecutionStatuses 失敗時應仍可點擊返回按鈕並導向上一頁（頁面錯誤出口一致性）', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.back')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('common.back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('API 失敗時 retry 再次失敗應顯示該次錯誤訊息（F05 重試錯誤反饋）', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(1);
    mockGetAllExecutionStatuses.mockRejectedValueOnce(new Error('重試時服務不可用'));
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('重試時服務不可用')).toBeInTheDocument();
    });
  });

  it('API 失敗時 retry 再次失敗且 message 為空字串應使用 getExecutionStatusFail（F10 邊界）', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue(new Error('網絡錯誤'));
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockGetAllExecutionStatuses.mockRejectedValueOnce({ code: 'SERVER_ERROR', message: '' });
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('message.getExecutionStatusFail')).toBeInTheDocument();
    });
  });

  it('API 失敗時點擊 retry 應重新呼叫 getAllExecutionStatuses', async () => {
    mockGetAllExecutionStatuses
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([]);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(2);
    });
  });

  it('getAllExecutionStatuses 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示執行資料（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    const executions = [
      {
        plan_id: 'plan-retry2',
        status: 'in_progress',
        records: [],
        progress: 50,
        plan_summary: { title: '第二次重試後方案', plan_type: 'activity', difficulty_level: 'easy' },
      },
    ];
    mockGetAllExecutionStatuses
      .mockRejectedValueOnce(new Error('第一次失敗'))
      .mockRejectedValueOnce(new Error('第二次仍失敗'))
      .mockResolvedValueOnce(executions);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('common.retry')).toBeInTheDocument());
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('common.retry')).toBeInTheDocument());
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(3);
      expect(screen.getByText('第二次重試後方案')).toBeInTheDocument();
    });
  });

  it('getAllExecutionStatuses 失敗後點擊 retry 成功應顯示執行資料（F05 錯誤恢復：失敗不阻塞重試）', async () => {
    const executions = [
      {
        plan_id: 'plan-retry',
        status: 'in_progress',
        records: [],
        progress: 30,
        plan_summary: { title: '重試後方案', plan_type: 'activity', difficulty_level: 'easy' },
      },
    ];
    mockGetAllExecutionStatuses
      .mockRejectedValueOnce(new Error('網絡暫時中斷'))
      .mockResolvedValueOnce(executions);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(2);
      expect(screen.getByText('重試後方案')).toBeInTheDocument();
      expect(screen.getByText('execDashboard.checkIn')).toBeInTheDocument();
    });
  });

  it('retry 快速連點只會送出一次 getAllExecutionStatuses 請求', async () => {
    let resolveFetch: (v: unknown) => void;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    mockGetAllExecutionStatuses
      .mockRejectedValueOnce(new Error('network error'))
      .mockImplementation(() => fetchPromise as Promise<unknown>);
    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(1);
    const retryBtn = screen.getByText('common.retry');
    await userEvent.click(retryBtn);
    await userEvent.click(retryBtn);
    await userEvent.click(retryBtn);
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(2);
    });
    resolveFetch!([]);
    await waitFor(() => {
      expect(screen.getByText('execDashboard.empty')).toBeInTheDocument();
    });
  });

  it('retry 失敗但組件已卸載時不應呼叫 message.error（mounted 回歸：避免卸載後誤提示）', async () => {
    let rejectRetry: (reason?: unknown) => void;
    mockGetAllExecutionStatuses
      .mockRejectedValueOnce(new Error('第一次失敗'))
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectRetry = reject; }));
    const user = userEvent.setup();
    const { unmount } = render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });
    mockMessageError.mockClear();
    await user.click(screen.getByText('common.retry'));
    await waitFor(() => {
      expect(mockGetAllExecutionStatuses).toHaveBeenCalledTimes(2);
    });
    unmount();
    await act(async () => {
      rejectRetry!(new Error('重試失敗'));
      await Promise.resolve();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('頁面應具備無障礙 role 與 aria-label', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue([]);
    const { container } = render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(container.querySelector('[role="main"][aria-label="execDashboard.pageLabel"]')).toBeInTheDocument();
    });
  });
});
