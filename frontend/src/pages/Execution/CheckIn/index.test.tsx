/**
 * Execution CheckIn 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
