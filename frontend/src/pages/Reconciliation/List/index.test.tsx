/**
 * Reconciliation List 頁面單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetPlans = vi.fn();
const mockSelectPlan = vi.fn();
const mockGeneratePlans = vi.fn();
const mockNavigate = vi.fn();
const mockMessageError = vi.fn();
const mockMessageSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/services/api/reconciliation', () => ({
  getPlans: (...args: unknown[]) => mockGetPlans(...args),
  selectPlan: (...args: unknown[]) => mockSelectPlan(...args),
  generatePlans: (...args: unknown[]) => mockGeneratePlans(...args),
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <span data-testid="mediator-avatar">MediatorAvatar</span> }));
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

import ReconciliationList from './index';

const mockPlan = {
  id: 'p1',
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

function renderPage(judgmentId = 'j1') {
  return render(
    <MemoryRouter initialEntries={[`/reconciliation/${judgmentId}`]}>
      <Routes>
        <Route path="/reconciliation/:judgmentId" element={<ReconciliationList />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReconciliationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlans.mockResolvedValue([mockPlan]);
  });

  it('掛載時應呼叫 getPlans', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledWith('j1', {});
    });
  });

  it('空列表時應顯示空狀態與生成按鈕', async () => {
    mockGetPlans.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.empty')).toBeInTheDocument();
    });
    expect(screen.getByText('reconList.generatePlans')).toBeInTheDocument();
  });

  it('getPlans NOT_FOUND 時應設空列表', async () => {
    mockGetPlans.mockRejectedValue({ code: 'NOT_FOUND', message: 'Not found' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('reconList.empty')).toBeInTheDocument();
    });
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it('getPlans 其他錯誤時應顯示 message.error', async () => {
    mockGetPlans.mockRejectedValue({ code: 'SERVER_ERROR', message: '伺服器錯誤' });
    renderPage();
    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('伺服器錯誤');
    });
  });
});
