import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetExecutionStatus = vi.fn();
const mockCheckin = vi.fn();
const mockUploadEvidence = vi.fn();
const mockGetPlanById = vi.fn();
const mockNavigate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastWarning = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/api/execution', () => ({
  getExecutionStatus: (...args: unknown[]) => mockGetExecutionStatus(...args),
  checkin: (...args: unknown[]) => mockCheckin(...args),
}));

vi.mock('@/services/api/case', () => ({
  uploadEvidence: (...args: unknown[]) => mockUploadEvidence(...args),
}));

vi.mock('@/services/api/reconciliation', () => ({
  getPlanById: (...args: unknown[]) => mockGetPlanById(...args),
}));

vi.mock('@/utils/i18n', () => ({ getLocale: () => 'zh-TW', t: (key: string) => key }));
vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

import ExecutionCheckIn from './index';

const executionStatus = {
  plan_id: 'plan-1',
  status: 'in_progress',
  journey_status: 'solo_active',
  relationship_mode: 'solo',
  records: [],
  recent_checkins: [
    {
      id: 'checkin-1',
      step_index: 0,
      result: 'partial',
      closeness: 'same',
      stress: 'medium',
      needs_help: true,
      notes: '今天只做到一半',
      photos_urls: [],
      created_at: '2026-04-05T10:00:00Z',
      updated_at: '2026-04-05T10:00:00Z',
    },
  ],
  progress: 30,
  plan_summary: {
    title: '今天先低壓靠近',
    plan_type: 'communication',
    difficulty_level: 'easy',
    fit_reason: '先降低壓力',
    first_step: '先傳一句不逼回應的訊息',
    pause_rule: '先停一下再回來',
  },
  current_step: {
    step_index: 0,
    title: '今天的一小步',
    content: '先傳一句不逼回應的訊息',
    fallback_content: '如果太難，先只表達善意',
    pause_rule: '壓力太高就先停 24 小時',
  },
  pulse_summary: {
    closeness: 'same',
    stress: 'medium',
    needs_replan: false,
    needs_help: false,
  },
};

function renderPage(path = '/execution/plan-1/checkin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/execution/:planId/checkin" element={<ExecutionCheckIn />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExecutionCheckIn', () => {
  beforeEach(() => {
    mockGetExecutionStatus.mockReset();
    mockCheckin.mockReset();
    mockUploadEvidence.mockReset();
    mockGetPlanById.mockReset();
    mockNavigate.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
    mockToastWarning.mockReset();
  });

  it('顯示今天的一小步與最近脈搏紀錄', async () => {
    mockGetExecutionStatus.mockResolvedValue(executionStatus);

    renderPage();

    await waitFor(() => {
      expect(mockGetExecutionStatus).toHaveBeenCalledWith('plan-1');
    });

    expect(screen.getByText('execCheckIn.heading')).toBeInTheDocument();
    expect(screen.getByText('先傳一句不逼回應的訊息')).toBeInTheDocument();
    expect(screen.getByText('execCheckIn.historyTitle')).toBeInTheDocument();
    expect(screen.getByText('今天只做到一半')).toBeInTheDocument();
  });

  it('不預選脈搏 telemetry，未填項目以 undefined 交給 API serialization', async () => {
    const user = userEvent.setup();
    mockGetExecutionStatus.mockResolvedValue(executionStatus);
    mockCheckin.mockResolvedValue({ id: 'execution-1' });

    renderPage();

    const doneButton = await screen.findByRole('button', { name: 'execCheckIn.stepResult.done' });
    expect(doneButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'execCheckIn.closeness.same' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'execCheckIn.stress.medium' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('radio', { name: 'execCheckIn.needsHelp.no' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'execCheckIn.needsHelp.yes' })).not.toBeChecked();

    await user.click(doneButton);
    await user.click(screen.getByRole('button', { name: 'execCheckIn.submitBtn' }));

    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith({
        plan_id: 'plan-1',
        notes: undefined,
        photos: [],
        step_result: 'done',
        closeness: undefined,
        stress: undefined,
        needs_help: undefined,
      });
    });
  });

  it('後端回傳缺少 recent_checkins 時仍可正常提交每日脈搏', async () => {
    const user = userEvent.setup();
    mockGetExecutionStatus.mockResolvedValue({
      ...executionStatus,
      recent_checkins: undefined,
      records: undefined,
    });
    mockCheckin.mockResolvedValue({ id: 'execution-1' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'execCheckIn.submitBtn' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'execCheckIn.stepResult.partial' }));
    await user.click(screen.getByRole('button', { name: 'execCheckIn.closeness.closer' }));
    await user.click(screen.getByRole('button', { name: 'execCheckIn.stress.high' }));
    await user.click(screen.getByRole('radio', { name: 'execCheckIn.needsHelp.yes' }));
    await user.type(screen.getByRole('textbox'), '今天先做到一半。');
    await user.click(screen.getByRole('button', { name: 'execCheckIn.submitBtn' }));

    await waitFor(() => {
      expect(mockCheckin).toHaveBeenCalledWith({
        plan_id: 'plan-1',
        notes: '今天先做到一半。',
        photos: [],
        step_result: 'partial',
        closeness: 'closer',
        stress: 'high',
        needs_help: true,
      });
    });
  });

  it('載入失敗時顯示錯誤並允許 retry 與返回看板', async () => {
    mockGetExecutionStatus
      .mockRejectedValueOnce(new Error('載入旅程失敗'))
      .mockResolvedValueOnce(executionStatus);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.notFound')).toBeInTheDocument();
      expect(screen.getByText('common.retry')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'execCheckIn.backToDashboard' }));
    expect(mockNavigate).toHaveBeenCalledWith('/execution/dashboard');

    await userEvent.click(screen.getByRole('button', { name: 'common.retry' }));

    await waitFor(() => {
      expect(screen.getByText('execCheckIn.heading')).toBeInTheDocument();
    });
  });
});
