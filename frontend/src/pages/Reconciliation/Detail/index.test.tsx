import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetPlanById = vi.fn();
const mockSelectPlan = vi.fn();
const mockInvitePartner = vi.fn();
const mockPausePlan = vi.fn();
const mockRespondPlan = vi.fn();
const mockConfirmExecution = vi.fn();
const mockResumeTrack = vi.fn();
const mockNavigate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api/reconciliation', () => ({
  getPlanById: (...args: unknown[]) => mockGetPlanById(...args),
  selectPlan: (...args: unknown[]) => mockSelectPlan(...args),
  invitePartner: (...args: unknown[]) => mockInvitePartner(...args),
  pausePlan: (...args: unknown[]) => mockPausePlan(...args),
  respondPlan: (...args: unknown[]) => mockRespondPlan(...args),
}));

vi.mock('@/services/api/execution', () => ({
  confirmExecution: (...args: unknown[]) => mockConfirmExecution(...args),
  resumeTrack: (...args: unknown[]) => mockResumeTrack(...args),
}));

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import ReconciliationDetail from './index';

const planContent = {
  title: '一起恢復安全感',
  description: '先做一件低壓的小事，讓關係重新有空間。',
  steps: ['先做一件低壓的小事'],
  expected_effect: '讓對話重新回到安全範圍',
  fit_reason: '因為你們現在更需要降低壓力，而不是立刻談完所有問題。',
  do_not_use_when: ['情緒還在高峰時'],
  first_step: '先傳一則不逼迫回應的關心訊息',
  fallback_step: '先只表達善意，不談責任',
  pause_rule: '如果任一方壓力太高，先停一天',
};

const createPlan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  judgment_id: 'j1',
  judgment: { case_id: 'c1' },
  intent: 'repair',
  plan_content: JSON.stringify(planContent),
  content: planContent,
  plan_type: 'communication',
  difficulty_level: 'easy',
  estimated_duration: 7,
  time_cost: 1,
  money_cost: 0,
  emotion_cost: 1,
  skill_requirement: 1,
  user1_selected: false,
  user2_selected: false,
  created_at: '2026-04-05T00:00:00Z',
  fit_reason: planContent.fit_reason,
  first_step: planContent.first_step,
  fallback_step: planContent.fallback_step,
  pause_rule: planContent.pause_rule,
  do_not_use_when: planContent.do_not_use_when,
  commitment: {
    track_id: 'track-1',
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
    partner: {
      user_id: 'u2',
      commitment_status: 'not_viewed',
      viewed_at: null,
      committed_at: null,
    },
  },
  invite_context: {
    partner_invited_at: null,
    partner_status: 'not_viewed',
    can_invite: true,
  },
  ...overrides,
});

function renderPage(path = '/reconciliation/j1/plan-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reconciliation/:judgmentId/:id" element={<ReconciliationDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReconciliationDetail', () => {
  beforeEach(() => {
    mockGetPlanById.mockReset();
    mockSelectPlan.mockReset();
    mockInvitePartner.mockReset();
    mockPausePlan.mockReset();
    mockRespondPlan.mockReset();
    mockConfirmExecution.mockReset();
    mockResumeTrack.mockReset();
    mockNavigate.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
  });

  it('顯示承諾工作台與reconDetail.commitmentTitle', async () => {
    mockGetPlanById.mockResolvedValue(createPlan());

    renderPage();

    await waitFor(() => {
      expect(mockGetPlanById).toHaveBeenCalledWith('plan-1');
    });

    expect(screen.getByRole('heading', { name: '一起恢復安全感' })).toBeInTheDocument();
    expect(screen.getByText('reconDetail.commitmentTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconDetail.actionSoloStart/ })).toBeInTheDocument();
  });

  it('已承諾但尚未雙方共修時可邀請對方或開始第一步', async () => {
    mockGetPlanById.mockResolvedValue(createPlan({
      commitment: {
        track_id: 'track-1',
        track_status: 'solo_active',
        recommended_mode: 'solo',
        invited_partner_at: null,
        is_dual_committed: false,
        current_user: {
          user_id: 'u1',
          commitment_status: 'committed',
          viewed_at: null,
          committed_at: '2026-04-05T01:00:00Z',
        },
        partner: {
          user_id: 'u2',
          commitment_status: 'viewed',
          viewed_at: '2026-04-05T01:10:00Z',
          committed_at: null,
        },
      },
    }));
    mockInvitePartner.mockResolvedValue({
      track_id: 'track-1',
      partner_id: 'u2',
      invited_at: '2026-04-05T01:30:00Z',
      status: 'partner_invited',
    });
    mockConfirmExecution.mockResolvedValue({ id: 'exec-1' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reconDetail.actionInvite/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /reconDetail.actionInvite/ }));

    await waitFor(() => {
      expect(mockInvitePartner).toHaveBeenCalledWith('plan-1');
    });

    await userEvent.click(screen.getByRole('button', { name: /reconDetail.actionStartToday/ }));

    await waitFor(() => {
      expect(mockConfirmExecution).toHaveBeenCalledWith('plan-1');
      expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-1/checkin');
    });
  });

  it('可先承諾再暫停，且失敗時保留重試出口', async () => {
    mockGetPlanById
      .mockResolvedValueOnce(createPlan())
      .mockResolvedValueOnce(createPlan({
        commitment: {
          track_id: 'track-1',
          track_status: 'solo_active',
          recommended_mode: 'solo',
          invited_partner_at: null,
          is_dual_committed: false,
          current_user: {
            user_id: 'u1',
            commitment_status: 'committed',
            viewed_at: null,
            committed_at: '2026-04-05T01:00:00Z',
          },
          partner: null,
        },
      }))
      .mockResolvedValueOnce(createPlan({
        commitment: {
          track_id: 'track-1',
          track_status: 'paused',
          recommended_mode: 'solo',
          invited_partner_at: null,
          is_dual_committed: false,
          current_user: {
            user_id: 'u1',
            commitment_status: 'committed',
            viewed_at: null,
            committed_at: '2026-04-05T01:00:00Z',
          },
          partner: null,
        },
      }));
    mockSelectPlan.mockResolvedValue(createPlan());
    mockPausePlan.mockResolvedValue({
      track_id: 'track-1',
      track_status: 'paused',
      recommended_mode: 'solo',
      invited_partner_at: null,
      is_dual_committed: false,
      current_user: {
        user_id: 'u1',
        commitment_status: 'paused',
        viewed_at: null,
        committed_at: null,
      },
      partner: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reconDetail.actionSoloStart/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /reconDetail.actionSoloStart/ }));

    await waitFor(() => {
      expect(mockSelectPlan).toHaveBeenCalledWith('plan-1');
    });

    await userEvent.click(screen.getByRole('button', { name: /reconDetail.actionPause/ }));

    await waitFor(() => {
      expect(mockPausePlan).toHaveBeenCalledWith('plan-1');
    });
  });

  it('載入失敗時顯示錯誤並允許 retry', async () => {
    mockGetPlanById
      .mockRejectedValueOnce(new Error('方案載入失敗'))
      .mockResolvedValueOnce(createPlan());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('方案載入失敗')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'common.retry' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '一起恢復安全感' })).toBeInTheDocument();
    });
  });

  it('invitee 進場時會自動標記 viewed，並可接受邀請', async () => {
    mockGetPlanById
      .mockResolvedValueOnce(createPlan({
        viewer_role: 'invitee',
        commitment: {
          track_id: 'track-1',
          track_status: 'partner_invited',
          recommended_mode: 'solo',
          invited_partner_at: '2026-04-05T01:00:00Z',
          is_dual_committed: false,
          current_user: {
            user_id: 'u2',
            commitment_status: 'not_viewed',
            viewed_at: null,
            committed_at: null,
          },
          partner: {
            user_id: 'u1',
            commitment_status: 'committed',
            viewed_at: '2026-04-05T00:00:00Z',
            committed_at: '2026-04-05T00:00:00Z',
          },
        },
      }))
      .mockResolvedValueOnce(createPlan({
        viewer_role: 'invitee',
        commitment: {
          track_id: 'track-1',
          track_status: 'partner_invited',
          recommended_mode: 'solo',
          invited_partner_at: '2026-04-05T01:00:00Z',
          is_dual_committed: false,
          current_user: {
            user_id: 'u2',
            commitment_status: 'viewed',
            viewed_at: '2026-04-05T01:10:00Z',
            committed_at: null,
          },
          partner: {
            user_id: 'u1',
            commitment_status: 'committed',
            viewed_at: '2026-04-05T00:00:00Z',
            committed_at: '2026-04-05T00:00:00Z',
          },
        },
      }))
      .mockResolvedValueOnce(createPlan({
        viewer_role: 'invitee',
        commitment: {
          track_id: 'track-1',
          track_status: 'co_active',
          recommended_mode: 'co',
          invited_partner_at: '2026-04-05T01:00:00Z',
          is_dual_committed: true,
          current_user: {
            user_id: 'u2',
            commitment_status: 'committed',
            viewed_at: '2026-04-05T01:10:00Z',
            committed_at: '2026-04-05T01:12:00Z',
          },
          partner: {
            user_id: 'u1',
            commitment_status: 'committed',
            viewed_at: '2026-04-05T00:00:00Z',
            committed_at: '2026-04-05T00:00:00Z',
          },
        },
      }));
    mockRespondPlan.mockResolvedValue(createPlan());

    renderPage();

    await waitFor(() => {
      expect(mockRespondPlan).toHaveBeenCalledWith('plan-1', 'viewed');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reconDetail.actionCommit/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /reconDetail.actionCommit/ }));

    await waitFor(() => {
      expect(mockRespondPlan).toHaveBeenCalledWith('plan-1', 'committed');
    });
  });
});
