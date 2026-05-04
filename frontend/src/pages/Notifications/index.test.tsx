import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockStore = {
  items: [] as Array<{
    id: string;
    template_code: string;
    unread: boolean;
    actionable: boolean;
    acted_at: string | null;
    dismissed_at: string | null;
    created_at: string;
    action_key: string | null;
    render_payload: {
      title: string;
      body: string;
      path: string | null;
      cta_label: string | null;
      journey_status: string | null;
      priority?: string | null;
      partner_state?: string | null;
      reason_code?: string | null;
    };
    priority?: string | null;
    group_key?: string | null;
    snoozed_until?: string | null;
    journey_context?: { entry_path?: string; primary_cta?: { path: string; label: string }; presentation_bucket?: string } | null;
  }>,
  unreadCount: 0,
  activeState: 'actionable' as const,
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  error: null as string | null,
  fetchNotifications: vi.fn().mockResolvedValue(undefined),
  fetchUnreadCount: vi.fn().mockResolvedValue(0),
  markRead: vi.fn().mockResolvedValue(null),
  markAllRead: vi.fn().mockResolvedValue(undefined),
  dismiss: vi.fn().mockResolvedValue(null),
  snooze: vi.fn().mockResolvedValue(null),
  act: vi.fn().mockResolvedValue({ path: '/execution/p1/checkin', action_key: 'continue_today_step' }),
  clearError: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/store/notificationStore', () => ({
  useNotificationStore: () => mockStore,
}));

vi.mock('@/components/common/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/common/AnimatedWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import NotificationsPage from './index';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.items = [];
    mockStore.unreadCount = 0;
    mockStore.activeState = 'actionable';
    mockStore.hasMore = false;
    mockStore.isLoading = false;
    mockStore.isLoadingMore = false;
    mockStore.error = null;
  });

  it('初始載入時應拉取通知與未讀數', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockStore.fetchNotifications).toHaveBeenCalledWith('actionable');
      expect(mockStore.fetchUnreadCount).toHaveBeenCalled();
    });
  });

  it('可從通知卡片執行 act 並跳轉', async () => {
    mockStore.items = [
      {
        id: 'n1',
        template_code: 'repair_journey_replan',
        unread: true,
        actionable: true,
        acted_at: null,
        dismissed_at: null,
        created_at: '2026-04-05T00:00:00.000Z',
        action_key: 'replan_track',
        render_payload: {
          title: '需要重新調整',
          body: '這一輪目前太吃力了。',
          path: '/execution/p1/replan',
          cta_label: '重新調整這一輪',
          journey_status: 'replanning',
          priority: 'now',
          partner_state: null,
          reason_code: null,
        },
        priority: 'now',
        group_key: 'repair_track_t1',
        snoozed_until: null,
        journey_context: {
          entry_path: '/execution/p1/replan',
          primary_cta: { path: '/execution/p1/replan', label: '重新調整這一輪' },
          presentation_bucket: 'replanning',
        },
      },
    ];

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: '重新調整這一輪' }));

    await waitFor(() => {
      expect(mockStore.act).toHaveBeenCalledWith('n1', 'replan_track');
      expect(mockNavigate).toHaveBeenCalledWith('/execution/p1/checkin');
    });
  });

  it('可將待處理通知稍後提醒', async () => {
    mockStore.items = [
      {
        id: 'n2',
        template_code: 'repair_journey_partner_invited',
        unread: true,
        actionable: true,
        acted_at: null,
        dismissed_at: null,
        created_at: '2026-04-05T00:00:00.000Z',
        action_key: 'review_invitation',
        priority: 'now',
        group_key: 'repair_track_t2',
        snoozed_until: null,
        journey_context: {
          entry_path: '/reconciliation/j1/p2',
          primary_cta: { path: '/reconciliation/j1/p2', label: '看看這個邀請' },
          presentation_bucket: 'partner_waiting',
        },
        render_payload: {
          title: '對方邀請你一起試試看',
          body: '你可以先看一眼。',
          path: '/reconciliation/j1/p2',
          cta_label: '看看這個邀請',
          journey_status: 'partner_invited',
          priority: 'now',
          partner_state: 'invited',
          reason_code: 'invite_pending',
        },
      },
    ];

    renderPage();

    const snoozeButtons = screen.getAllByRole('button', { name: /稍後提醒/ });
    await userEvent.click(snoozeButtons[snoozeButtons.length - 1]);

    await waitFor(() => {
      expect(mockStore.snooze).toHaveBeenCalledWith('n2', 24);
    });
  });
});
