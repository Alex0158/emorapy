import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AIStreamSnapshot } from '@/types/aiStream';

const mockGetExecutionStatus = vi.fn();
const mockReplanTrack = vi.fn();
const mockNavigate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockUseAIStreamSubscription = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api/execution', () => ({
  getExecutionStatus: (...args: unknown[]) => mockGetExecutionStatus(...args),
  replanTrack: (...args: unknown[]) => mockReplanTrack(...args),
}));

vi.mock('@/hooks/useAIStreamSubscription', () => ({
  useAIStreamSubscription: (...args: unknown[]) => mockUseAIStreamSubscription(...args),
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
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

import ExecutionReplan from './index';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/execution/plan-1/replan']}>
      <Routes>
        <Route path="/execution/:planId/replan" element={<ExecutionReplan />} />
      </Routes>
    </MemoryRouter>,
  );
}

function buildSnapshot(overrides: Partial<AIStreamSnapshot> = {}): AIStreamSnapshot {
  return {
    streamId: 'stream-1',
    requestId: 'request-1',
    scopeType: 'repair_track',
    scopeId: 'track-1',
    status: 'streaming',
    lastSeq: 3,
    text: '',
    metadata: { task_type: 'repair_replan' },
    updatedAt: '2026-04-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('ExecutionReplan', () => {
  beforeEach(() => {
    mockGetExecutionStatus.mockReset();
    mockReplanTrack.mockReset();
    mockNavigate.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
    mockUseAIStreamSubscription.mockReset();
    mockUseAIStreamSubscription.mockReturnValue({
      state: { latestSnapshot: null, phaseHistory: [], latestEvent: null },
      isRecovering: false,
      lastSeq: 0,
      resetState: vi.fn(),
      setState: vi.fn(),
    });
  });

  it('可提交 async replan，並切到等待態', async () => {
    mockGetExecutionStatus.mockResolvedValue({
      track_id: 'track-1',
      plan_id: 'plan-1',
      journey_status: 'solo_active',
      status_reason: 'needs_help',
      replan_recommendation: 'lower_pressure',
      plan_summary: { title: '這一輪', plan_type: 'communication', difficulty_level: 'easy' },
      current_step: { step_index: 0, title: '今天的一小步', content: '先做一點低壓靠近' },
      records: [],
      recent_checkins: [],
      progress: 30,
      status: 'in_progress',
      relationship_mode: 'solo',
      active_replan_stream_id: null,
      replan_state: null,
      superseded_plan_id: null,
    });
    mockReplanTrack.mockResolvedValue({
      track_id: 'track-1',
      status: 'replanning',
      accepted: true,
      stream_scope: 'repair_track',
      scope_id: 'track-1',
      stream_id: 'stream-1',
      request_id: 'request-1',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'execReplan.heading' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /execReplan\.submitBtn/ }));

    await waitFor(() => {
      expect(mockReplanTrack).toHaveBeenCalledWith('track-1', {
        reason: 'needs_help',
        mode: 'lower_pressure',
      });
    });

    expect(mockToastSuccess).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'execReplan.waitingTitle' })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('收到 persisted snapshot 後應跳到新 plan', async () => {
    mockGetExecutionStatus.mockResolvedValue({
      track_id: 'track-1',
      plan_id: 'plan-1',
      journey_status: 'replanning',
      status_reason: 'manual',
      replan_recommendation: 'lower_pressure',
      plan_summary: { title: '這一輪', plan_type: 'communication', difficulty_level: 'easy' },
      current_step: { step_index: 0, title: '今天的一小步', content: '先做一點低壓靠近' },
      records: [],
      recent_checkins: [],
      progress: 30,
      status: 'in_progress',
      relationship_mode: 'solo',
      active_replan_stream_id: 'stream-1',
      replan_state: 'replanning',
      superseded_plan_id: null,
    });
    mockUseAIStreamSubscription.mockReturnValue({
      state: {
        latestSnapshot: buildSnapshot({
          status: 'persisted',
          text: '新的版本已經準備好',
          metadata: { task_type: 'repair_replan', plan_id: 'plan-2' },
        }),
        phaseHistory: ['collecting_context', 'drafting_adjustment', 'finalizing_plan'],
        latestEvent: null,
      },
      isRecovering: false,
      lastSeq: 5,
      resetState: vi.fn(),
      setState: vi.fn(),
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/execution/plan-2/checkin');
    });
  });

  it('terminal stream fixed invalid-response fallback 應轉成本地化錯誤', async () => {
    mockGetExecutionStatus.mockResolvedValue({
      track_id: 'track-1',
      plan_id: 'plan-1',
      journey_status: 'replanning',
      status_reason: 'manual',
      replan_recommendation: 'lower_pressure',
      plan_summary: { title: '這一輪', plan_type: 'communication', difficulty_level: 'easy' },
      current_step: { step_index: 0, title: '今天的一小步', content: '先做一點低壓靠近' },
      records: [],
      recent_checkins: [],
      progress: 30,
      status: 'in_progress',
      relationship_mode: 'solo',
      active_replan_stream_id: 'stream-1',
      replan_state: 'replanning',
      superseded_plan_id: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'execReplan.waitingTitle' })).toBeInTheDocument();
    });

    const options = mockUseAIStreamSubscription.mock.calls.at(-1)?.[0] as {
      onTerminalError: (error: { code: string; message: string; status?: number }) => void;
    };

    act(() => {
      options.onTerminalError({
        code: 'INVALID_REPAIR_TRACK_RESPONSE',
        message: 'Invalid repair track response from server',
        status: 500,
      });
    });

    expect(screen.getByText('apiError.invalidResponse')).toBeInTheDocument();
  });

  it('failed snapshot fixed invalid-response fallback 應轉成本地化錯誤', async () => {
    mockGetExecutionStatus.mockResolvedValue({
      track_id: 'track-1',
      plan_id: 'plan-1',
      journey_status: 'replanning',
      status_reason: 'manual',
      replan_recommendation: 'lower_pressure',
      plan_summary: { title: '這一輪', plan_type: 'communication', difficulty_level: 'easy' },
      current_step: { step_index: 0, title: '今天的一小步', content: '先做一點低壓靠近' },
      records: [],
      recent_checkins: [],
      progress: 30,
      status: 'in_progress',
      relationship_mode: 'solo',
      active_replan_stream_id: 'stream-1',
      replan_state: 'replanning',
      superseded_plan_id: null,
    });
    mockUseAIStreamSubscription.mockReturnValue({
      state: {
        latestSnapshot: buildSnapshot({
          status: 'failed',
          error: {
            code: 'INVALID_REPAIR_TRACK_RESPONSE',
            message: 'Invalid repair track response from server',
          },
        }),
        phaseHistory: ['collecting_context'],
        latestEvent: null,
      },
      isRecovering: false,
      lastSeq: 5,
      resetState: vi.fn(),
      setState: vi.fn(),
    });

    renderPage();

    expect(await screen.findByText('apiError.invalidResponse')).toBeInTheDocument();
  });
});
