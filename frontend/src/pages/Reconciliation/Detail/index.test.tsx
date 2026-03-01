/**
 * Reconciliation Detail 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetPlanById = vi.fn();
const mockGetPlans = vi.fn();
const mockSelectPlan = vi.fn();
const mockConfirmExecution = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/services/api/reconciliation', () => ({
  getPlanById: (...args: unknown[]) => mockGetPlanById(...args),
  getPlans: (...args: unknown[]) => mockGetPlans(...args),
  selectPlan: (...args: unknown[]) => mockSelectPlan(...args),
}));
vi.mock('@/services/api/execution', () => ({
  confirmExecution: (...args: unknown[]) => mockConfirmExecution(...args),
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
      info: vi.fn(),
      warning: vi.fn(),
    },
  };
});

import ReconciliationDetail from './index';

const mockPlan = {
  id: 'plan-1',
  judgment_id: 'j1',
  plan_content: '方案一內容',
  plan_type: 'activity' as const,
  difficulty_level: 'easy' as const,
  time_cost: 2,
  money_cost: 1,
  emotion_cost: 3,
  skill_requirement: 2,
  user1_selected: false,
  user2_selected: false,
  created_at: '2025-01-01T00:00:00Z',
};

function renderPage(judgmentId = 'j1', id = 'plan-1') {
  return render(
    <MemoryRouter initialEntries={[`/reconciliation/${judgmentId}/${id}`]}>
      <Routes>
        <Route path="/reconciliation/:judgmentId/:id" element={<ReconciliationDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReconciliationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlanById.mockResolvedValue(mockPlan);
  });

  it('掛載時應呼叫 getPlanById', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledWith('plan-1');
    });
  });

  it('getPlanById 失敗時應 fallback 到 getPlans', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockResolvedValue([mockPlan]);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledWith('j1');
    });
  });

  it('方案不存在時應顯示 planNotFound', async () => {
    mockGetPlanById.mockRejectedValue(new Error('not found'));
    mockGetPlans.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('message.planNotFound');
    });
  });

  it('方案載入成功後應顯示方案詳情', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
  });

  it('handleSelect: 點擊選擇方案應呼叫 selectPlan', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.selectThisPlan')).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /reconDetail\.selectThisPlan/ }).click();
    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledWith('plan-1');
    });
  });

  it('handleStartExecution: 方案已選擇時點擊開始執行應呼叫 confirmExecution', async () => {
    mockGetPlanById.mockResolvedValue({ ...mockPlan, user1_selected: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconDetail.startExecution')).toBeInTheDocument();
    });
    await act(async () => {
      screen.getByRole('button', { name: /reconDetail\.startExecution/ }).click();
    });
    await waitFor(() => expect(mockConfirmExecution).toHaveBeenCalledWith('plan-1'));
  });
});
