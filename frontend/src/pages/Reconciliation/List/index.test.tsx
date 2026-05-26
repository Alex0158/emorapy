import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetPlans = vi.fn();
const mockGeneratePlans = vi.fn();
const mockSelectPlan = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api/reconciliation', () => ({
  getPlans: (...args: unknown[]) => mockGetPlans(...args),
  generatePlans: (...args: unknown[]) => mockGeneratePlans(...args),
  selectPlan: (...args: unknown[]) => mockSelectPlan(...args),
}));

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/business/MediatorAvatar', () => ({ default: () => <div data-testid="mediator-avatar" /> }));
import ReconciliationList from './index';

const basePlanContent = {
  description: '先從一個低壓的小動作開始靠近。',
  steps: ['先做一個小動作'],
  expected_effect: '讓彼此先恢復安全感',
  fit_reason: '它很適合目前的節奏。',
  do_not_use_when: ['情緒還在高峰'],
  first_step: '先傳一句不帶壓力的訊息',
  fallback_step: '先只表達關心，不談問題',
  pause_rule: '如果壓力太高，先停 24 小時',
};

const createPlan = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  judgment_id: 'j1',
  intent: 'repair',
  plan_content: JSON.stringify({
    title: `方案 ${id}`,
    ...basePlanContent,
  }),
  plan_type: 'communication' as const,
  difficulty_level: 'easy' as const,
  time_cost: 1,
  money_cost: 0,
  emotion_cost: 1,
  skill_requirement: 1,
  user1_selected: false,
  user2_selected: false,
  created_at: '2026-04-05T00:00:00Z',
  content: {
    title: `方案 ${id}`,
    ...basePlanContent,
  },
  commitment: {
    track_id: null,
    track_status: 'draft',
    recommended_mode: 'solo',
    invited_partner_at: null,
    is_dual_committed: false,
    current_user: {
      user_id: 'u1',
      commitment_status: 'not_viewed',
      viewed_at: null,
      committed_at: null,
    },
    partner: null,
  },
  ...overrides,
});

function renderPage(path = '/reconciliation/j1?intent=repair') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reconciliation/:judgmentId" element={<ReconciliationList />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReconciliationList', () => {
  beforeEach(() => {
    mockGetPlans.mockReset();
    mockGeneratePlans.mockReset();
    mockSelectPlan.mockReset();
    mockNavigate.mockReset();
  });

  it('按 query intent 載入旅程頁並顯示主推薦與備選', async () => {
    mockGetPlans.mockResolvedValue({
      plans: [createPlan('p1'), createPlan('p2'), createPlan('p3')],
      recommended_plan_id: 'p1',
      intent: 'cool_down',
      applied_preferences: null,
    });

    renderPage('/reconciliation/j1?intent=cool_down');

    await waitFor(() => {
      expect(mockGetPlans).toHaveBeenCalledWith('j1', { intent: 'cool_down' });
    });

    expect(screen.getByText('reconList.intent.coolDown.title')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '方案 p1' })).toBeInTheDocument();
    expect(screen.getByText('reconList.alternateTitle')).toBeInTheDocument();
  });

  it('空結果時可用預設偏好重新生成主推薦', async () => {
    mockGetPlans.mockResolvedValue({
      plans: [],
      recommended_plan_id: null,
      intent: 'repair',
      applied_preferences: null,
    });
    mockGeneratePlans.mockResolvedValue({
      plans: [createPlan('p9')],
      recommended_plan_id: 'p9',
      intent: 'repair',
      applied_preferences: { pressure_level: 'low', pace: 'today', style: ['action'], invite_partner: true },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'reconList.generateBtn' }).length).toBeGreaterThan(0);
    });

    const generateButtons = screen.getAllByRole('button', { name: 'reconList.generateBtn' });
    await userEvent.click(generateButtons[0]);

    await waitFor(() => {
      expect(mockGeneratePlans).toHaveBeenCalledWith('j1', {
        intent: 'repair',
        preferences: {
          pressure_level: 'low',
          pace: 'today',
          style: ['action'],
          invite_partner: true,
        },
        force_regenerate: false,
      });
    });

    expect(screen.getByRole('heading', { name: '方案 p9' })).toBeInTheDocument();
  });

  it('承諾主推薦後會進入承諾工作台', async () => {
    mockGetPlans.mockResolvedValue({
      plans: [createPlan('p1')],
      recommended_plan_id: 'p1',
      intent: 'repair',
      applied_preferences: null,
    });
    mockSelectPlan.mockResolvedValue(createPlan('p1'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reconList\.commitFromThis/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /reconList\.commitFromThis/ }));

    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledWith('p1');
      expect(mockNavigate).toHaveBeenCalledWith('/reconciliation/j1/p1');
    });
  });

  it('舊陣列形狀的回應仍可正常顯示主推薦', async () => {
    mockGetPlans.mockResolvedValue([createPlan('legacy-1')]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '方案 legacy-1' })).toBeInTheDocument();
    });
  });

  it('載入錯誤時保留 retry 出口', async () => {
    mockGetPlans
      .mockRejectedValueOnce(new Error('暫時不可用'))
      .mockResolvedValueOnce({
        plans: [createPlan('p2')],
        recommended_plan_id: 'p2',
        intent: 'repair',
        applied_preferences: null,
      });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('暫時不可用')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'common.retry' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '方案 p2' })).toBeInTheDocument();
    });
  });
});
