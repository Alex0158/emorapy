import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockGetAllExecutionStatuses = vi.fn();
const mockResumeTrack = vi.fn();
const mockToastError = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/api/execution', () => ({
  getAllExecutionStatuses: (...args: unknown[]) => mockGetAllExecutionStatuses(...args),
  resumeTrack: (...args: unknown[]) => mockResumeTrack(...args),
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }));
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/common/EmptyState', () => ({
  EmptyState: ({ variant, actionLabel, onAction }: { variant?: string; actionLabel?: string; onAction?: () => void }) => (
    <div data-testid="empty-state" data-variant={variant}>
      <p>execDashboard.empty</p>
      {actionLabel && <button onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}));

import ExecutionDashboard from './index';

describe('ExecutionDashboard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetAllExecutionStatuses.mockReset();
    mockResumeTrack.mockReset();
    mockToastError.mockReset();
  });

  it('空資料時顯示空狀態', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('execDashboard.empty')).toBeInTheDocument();
    });
  });

  it('顯示進行中與已完成旅程，並可進入今天的一小步', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue([
      {
        plan_id: 'plan-1',
        judgment_id: 'j1',
        status: 'in_progress',
        journey_status: 'solo_active',
        relationship_mode: 'solo',
        records: [],
        recent_checkins: [],
        progress: 30,
        plan_summary: {
          title: '今天先低壓靠近',
          plan_type: 'communication',
          difficulty_level: 'easy',
          fit_reason: '先降低壓力',
          first_step: '先傳一句低壓訊息',
        },
        pulse_summary: {
          closeness: 'same',
          stress: 'medium',
          needs_replan: false,
          needs_help: false,
        },
        primary_cta: 'continue_today_step',
      },
      {
        plan_id: 'plan-2',
        judgment_id: 'j2',
        status: 'completed',
        journey_status: 'completed',
        relationship_mode: 'co',
        records: [],
        recent_checkins: [],
        progress: 100,
        plan_summary: {
          title: '一起恢復安全感',
          plan_type: 'activity',
          difficulty_level: 'medium',
          first_step: '先回到固定陪伴',
        },
        primary_cta: 'review_completed_journey',
      },
    ]);

    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('execDashboard.section.active')).toBeInTheDocument();
      expect(screen.getByText('execDashboard.section.completed')).toBeInTheDocument();
    });

    expect(screen.getByText('今天先低壓靠近')).toBeInTheDocument();
    expect(screen.getByText('一起恢復安全感')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /execDashboard\.cta\.continueStep/ }));

    expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-1/checkin');
  });

  it('paused 卡可直接恢復這一輪', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue([
      {
        track_id: 'track-1',
        plan_id: 'plan-3',
        judgment_id: 'j3',
        status: 'in_progress',
        journey_status: 'paused',
        relationship_mode: 'solo',
        records: [],
        recent_checkins: [],
        progress: 40,
        plan_summary: {
          title: '先停一下再回來',
          plan_type: 'communication',
          difficulty_level: 'easy',
        },
        primary_cta: 'resume_track',
      },
    ]);
    mockResumeTrack.mockResolvedValue({ track_id: 'track-1', plan_id: 'plan-3', status: 'solo_active' });

    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /execDashboard\.cta\.resume/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /execDashboard\.cta\.resume/ }));

    await waitFor(() => {
      expect(mockResumeTrack).toHaveBeenCalledWith('track-1');
      expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-3/checkin');
    });
  });

  it('未知 journey_status 不會被誤歸類進看板卡片', async () => {
    mockGetAllExecutionStatuses.mockResolvedValue([
      {
        plan_id: 'plan-x',
        status: 'in_progress',
        journey_status: 'unknown_status',
        relationship_mode: 'solo',
        records: [],
        recent_checkins: [],
        progress: 10,
        plan_summary: { title: '不應出現', plan_type: 'activity', difficulty_level: 'easy' },
      },
    ]);

    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('不應出現')).not.toBeInTheDocument();
      expect(screen.getByText('execDashboard.empty')).toBeInTheDocument();
    });
  });

  it('載入失敗時顯示錯誤並允許 retry', async () => {
    mockGetAllExecutionStatuses
      .mockRejectedValueOnce(new Error('看板載入失敗'))
      .mockResolvedValueOnce([]);

    render(
      <MemoryRouter>
        <ExecutionDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('message.getExecutionStatusFail')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'common.retry' }));

    await waitFor(() => {
      expect(screen.getByText('execDashboard.empty')).toBeInTheDocument();
    });
  });
});
