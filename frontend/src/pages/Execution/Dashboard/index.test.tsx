/**
 * Execution Dashboard 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExecutionDashboard from './index';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockGetAllExecutionStatuses = vi.fn();
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

const mockMessageError = vi.fn();
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
    render(<ExecutionDashboard />);
    expect(screen.getByText('加載中...')).toBeInTheDocument();
  });

  it('無資料時應顯示空狀態與「前往案件列表」按鈕', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue([]);
    render(<ExecutionDashboard />);
    await waitFor(() => {
      expect(screen.getByText('暫無執行中的和好方案')).toBeInTheDocument();
    });
    const btn = screen.getByRole('button', { name: /前往案件列表/ });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/case/list');
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
    render(<ExecutionDashboard />);
    await waitFor(() => {
      expect(screen.getByText('執行儀表板')).toBeInTheDocument();
    });
    expect(screen.getByText('進行中')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('方案 A')).toBeInTheDocument();
    expect(screen.getByText('方案 B')).toBeInTheDocument();
    const checkinBtn = screen.getByRole('button', { name: /去打卡/ });
    expect(checkinBtn).toBeInTheDocument();
    await userEvent.click(checkinBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-1/checkin');
  });

  it('API 失敗時應顯示錯誤訊息並顯示空狀態', async () => {
    mockGetAllExecutionStatuses.mockRejectedValue(new Error('網絡錯誤'));
    render(<ExecutionDashboard />);
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('網絡錯誤');
    });
    await waitFor(() => {
      expect(screen.getByText('暫無執行中的和好方案')).toBeInTheDocument();
    });
  });

  it('頁面應具備無障礙 role 與 aria-label', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue([]);
    render(<ExecutionDashboard />);
    await waitFor(() => {
      expect(screen.getByRole('main', { name: '執行儀表板' })).toBeInTheDocument();
    });
  });
});
