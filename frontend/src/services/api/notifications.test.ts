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

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('notifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listNotifications 應正規化列表回應', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          notifications: [{ id: 'n1', render_payload: { title: '通知', body: '內容', path: '/execution/p1/checkin', cta_label: '查看', entity_type: 'repair_track', entity_id: 't1', journey_status: 'solo_active', track_id: 't1', plan_id: 'p1', judgment_id: 'j1', case_id: null }, unread: true, actionable: true }],
          next_cursor: 'cursor-1',
          has_more: true,
        },
      },
    });

    const result = await listNotifications({ state: 'actionable', cursor: 'cursor-0' });

    expect(mockGet).toHaveBeenCalledWith('/notifications', {
      params: { state: 'actionable', cursor: 'cursor-0' },
    });
    expect(result.notifications).toHaveLength(1);
    expect(result.next_cursor).toBe('cursor-1');
    expect(result.has_more).toBe(true);
  });

  it('unread/read/read-all/dismiss/snooze/act 應命中對應接口', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { unread_count: 4 } } });
    mockPost
      .mockResolvedValueOnce({ data: { data: { notification: { id: 'n1' } } } })
      .mockResolvedValueOnce({ data: { data: { updatedCount: 3, readAt: '2026-04-05T00:00:00.000Z' } } })
      .mockResolvedValueOnce({ data: { data: { notification: { id: 'n1' } } } })
      .mockResolvedValueOnce({ data: { data: { notification: { id: 'n1', snoozed_until: '2026-04-06T00:00:00.000Z' } } } })
      .mockResolvedValueOnce({ data: { data: { notification: { id: 'n1' }, target: { path: '/execution/p1/checkin', action_key: 'continue_today_step', entity_type: 'repair_track', entity_id: 't1' } } } });

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
    expect(mockPost).toHaveBeenNthCalledWith(1, '/notifications/n1/read');
    expect(mockPost).toHaveBeenNthCalledWith(2, '/notifications/read-all');
    expect(mockPost).toHaveBeenNthCalledWith(3, '/notifications/n1/dismiss');
    expect(mockPost).toHaveBeenNthCalledWith(4, '/notifications/n1/snooze', { hours: 24 });
    expect(mockPost).toHaveBeenNthCalledWith(5, '/notifications/n1/act', { action_key: 'continue_today_step' });
  });
});
