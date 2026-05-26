import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actOnNotification,
  dismissNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  snoozeNotification,
} from './notifications';

const mocks = vi.hoisted(() => {
  const list = vi.fn();
  const unreadCount = vi.fn();
  const markRead = vi.fn();
  const markAllRead = vi.fn();
  const dismiss = vi.fn();
  const snooze = vi.fn();
  const act = vi.fn();
  return {
    list,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
    snooze,
    act,
    createM5ApiClient: vi.fn(() => ({
      notifications: {
        list,
        unreadCount,
        markRead,
        markAllRead,
        dismiss,
        snooze,
        act,
      },
    })),
    request: { request: true },
  };
});

vi.mock('../request', () => ({
  default: mocks.request,
}));

vi.mock('@cj/api-client', () => ({
  createM5ApiClient: (...args: unknown[]) => mocks.createM5ApiClient(...args),
}));

describe('notifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listNotifications 應正規化列表回應', async () => {
    mocks.list.mockResolvedValue({
      notifications: [{ id: 'n1', render_payload: { title: '通知', body: '內容', path: '/execution/p1/checkin', cta_label: '查看', entity_type: 'repair_track', entity_id: 't1', journey_status: 'solo_active', track_id: 't1', plan_id: 'p1', judgment_id: 'j1', case_id: null }, unread: true, actionable: true }],
      next_cursor: 'cursor-1',
      has_more: true,
    });

    const result = await listNotifications({ state: 'actionable', cursor: 'cursor-0' });

    expect(mocks.list).toHaveBeenCalledWith({ state: 'actionable', cursor: 'cursor-0' });
    expect(result.notifications).toHaveLength(1);
    expect(result.next_cursor).toBe('cursor-1');
    expect(result.has_more).toBe(true);
  });

  it('unread/read/read-all/dismiss/snooze/act 應命中對應接口', async () => {
    mocks.unreadCount.mockResolvedValue(4);
    mocks.markRead.mockResolvedValue({ id: 'n1' });
    mocks.markAllRead.mockResolvedValue({ updatedCount: 3, readAt: '2026-04-05T00:00:00.000Z' });
    mocks.dismiss.mockResolvedValue({ id: 'n1' });
    mocks.snooze.mockResolvedValue({ id: 'n1', snoozed_until: '2026-04-06T00:00:00.000Z' });
    mocks.act.mockResolvedValue({
      notification: { id: 'n1' },
      target: { path: '/execution/p1/checkin', action_key: 'continue_today_step', entity_type: 'repair_track', entity_id: 't1' },
    });

    const count = await getUnreadNotificationCount();
    const marked = await markNotificationRead('n1');
    const readAll = await markAllNotificationsRead();
    const dismissed = await dismissNotification('n1');
    const snoozed = await snoozeNotification('n1', 24);
    const acted = await actOnNotification('n1', 'continue_today_step');

    expect(count).toBe(4);
    expect(marked.id).toBe('n1');
    expect(readAll.updatedCount).toBe(3);
    expect(dismissed.id).toBe('n1');
    expect(snoozed.id).toBe('n1');
    expect(acted.target.path).toBe('/execution/p1/checkin');
    expect(mocks.unreadCount).toHaveBeenCalledWith();
    expect(mocks.markRead).toHaveBeenCalledWith('n1');
    expect(mocks.markAllRead).toHaveBeenCalledWith();
    expect(mocks.dismiss).toHaveBeenCalledWith('n1');
    expect(mocks.snooze).toHaveBeenCalledWith('n1', 24);
    expect(mocks.act).toHaveBeenCalledWith('n1', 'continue_today_step');
  });
});
