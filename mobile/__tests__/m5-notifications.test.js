const React = require('react');
const { act, fireEvent, render, waitFor } = require('@testing-library/react-native');
const { notifyManager, QueryClient, QueryClientProvider } = require('@tanstack/react-query');

const mockPush = jest.fn();
const mockGetToken = jest.fn();
const mockListNotifications = jest.fn();
const mockUnreadCount = jest.fn();
const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockSnooze = jest.fn();
const mockDismiss = jest.fn();
const mockAct = jest.fn();
const mockRegisterPushTokenForCurrentUser = jest.fn();
const mockRequestPushPermission = jest.fn();
const mockGetPushTokenPayload = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockPush,
  },
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/src/config/runtime', () => ({
  getRuntimeConfig: () => ({
    appVersion: '1.3.1-test',
  }),
}));

jest.mock('@/src/features/m5/api', () => ({
  normalizeM5Error: (error) => ({ code: error?.code || 'APP_ERROR', message: error?.message || '請稍後再試。' }),
  m5Api: {
    notifications: {
      act: mockAct,
      dismiss: mockDismiss,
      list: mockListNotifications,
      markAllRead: mockMarkAllRead,
      markRead: mockMarkRead,
      snooze: mockSnooze,
      unreadCount: mockUnreadCount,
    },
  },
}));

jest.mock('@/src/features/m5/pushLifecycle', () => ({
  registerPushTokenForCurrentUser: mockRegisterPushTokenForCurrentUser,
}));

jest.mock('@/src/platform/linking/native', () => ({
  resolveAppHrefFromBackendPath: jest.fn(() => '/repair'),
}));

jest.mock('@/src/platform/notifications/native', () => ({
  getPushTokenPayload: mockGetPushTokenPayload,
  requestPushPermission: mockRequestPushPermission,
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  tokenStorage: {
    getToken: mockGetToken,
  },
}));

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: jest.fn(),
}));

const NotificationsScreen = require('../app/(app)/notifications/index').default;

const queryClients = [];

function renderWithQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  queryClients.push(queryClient);
  return render(React.createElement(QueryClientProvider, { client: queryClient }, ui));
}

const notification = {
  id: 'n1',
  channel: 'push',
  template_code: 'repair.checkin',
  action_key: 'continue_today_step',
  priority: 'soon',
  group_key: null,
  status: 'sent',
  error_message: null,
  created_at: '2026-05-08T00:00:00.000Z',
  sent_at: '2026-05-08T00:00:00.000Z',
  read_at: null,
  dismissed_at: null,
  acted_at: null,
  snoozed_until: null,
  unread: true,
  actionable: true,
  payload: {},
  journey_context: null,
  render_payload: {
    title: '今天的一小步',
    body: '回到修復旅程完成今日回報',
    path: '/execution/plan-1/checkin',
    cta_label: '開始',
    entity_type: 'repair_track',
    entity_id: 'track-1',
    journey_status: 'solo_active',
    track_id: 'track-1',
    plan_id: 'plan-1',
    judgment_id: 'judgment-1',
    case_id: 'case-1',
    priority: 'soon',
    partner_state: null,
    reason_code: null,
  },
};

describe('M5 Notifications screen', () => {
  beforeAll(() => {
    notifyManager.setNotifyFunction((callback) => {
      act(callback);
    });
  });

  afterAll(() => {
    notifyManager.setNotifyFunction((callback) => {
      callback();
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('jwt-token');
    mockListNotifications.mockResolvedValue({ notifications: [notification], next_cursor: null, has_more: false });
    mockUnreadCount.mockResolvedValue(1);
    mockAct.mockResolvedValue({
      notification: { ...notification, acted_at: 'now' },
      target: { path: '/execution/plan-1/checkin', action_key: 'continue_today_step', entity_type: 'repair_track', entity_id: 'track-1' },
    });
    mockMarkRead.mockResolvedValue({ ...notification, read_at: 'now' });
    mockMarkAllRead.mockResolvedValue({ updatedCount: 1, readAt: 'now' });
    mockSnooze.mockResolvedValue({ ...notification, snoozed_until: 'later' });
    mockDismiss.mockResolvedValue({ ...notification, dismissed_at: 'now' });
    mockRequestPushPermission.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetPushTokenPayload.mockResolvedValue({ token: 'ExpoPushToken[test]', platform: 'ios' });
    mockRegisterPushTokenForCurrentUser.mockResolvedValue({ id: 'push-token-1', platform: 'ios' });
  });

  afterEach(() => {
    while (queryClients.length) {
      queryClients.pop().clear();
    }
  });

  it('does not query notifications before auth is available', async () => {
    mockGetToken.mockResolvedValue(null);
    const screen = renderWithQuery(React.createElement(NotificationsScreen));

    expect(await screen.findByText('先登入')).toBeTruthy();
    expect(screen.getByText('提醒')).toBeTruthy();
    expect(screen.getByText('快速整理不打擾')).toBeTruthy();
    expect(screen.queryByText('NOTICE')).toBeNull();
    expect(screen.queryByText(/Quick/)).toBeNull();
    expect(mockListNotifications).not.toHaveBeenCalled();
  });

  it('opens notification action targets through the App deep-link resolver', async () => {
    const screen = renderWithQuery(React.createElement(NotificationsScreen));

    expect(await screen.findByText('今天的一小步')).toBeTruthy();
    expect(screen.getAllByText('提醒').length).toBeGreaterThan(0);
    expect(screen.queryByText('NOTICE')).toBeNull();
    expect(screen.getByText('目前：未讀')).toBeTruthy();
    expect(screen.getByText('近期提醒')).toBeTruthy();
    expect(screen.getByText(/提醒時間：/)).toBeTruthy();
    expect(screen.queryByText('unread')).toBeNull();
    expect(screen.queryByText('soon')).toBeNull();
    expect(screen.queryByText('sent')).toBeNull();
    expect(screen.queryByText(notification.created_at)).toBeNull();
    fireEvent.press(screen.getByText('開始'));

    await waitFor(() => expect(mockAct).toHaveBeenCalledWith('n1', 'continue_today_step'));
    expect(mockPush).toHaveBeenCalledWith('/repair');
  });

  it('does not fall back to backend template code when notification copy is incomplete', async () => {
    mockListNotifications.mockResolvedValueOnce({
      notifications: [{
        ...notification,
        render_payload: {
          ...notification.render_payload,
          body: null,
          title: null,
        },
      }],
      next_cursor: null,
      has_more: false,
    });
    const screen = renderWithQuery(React.createElement(NotificationsScreen));

    expect(await screen.findByText('通知')).toBeTruthy();
    expect(screen.getByText('有新的狀態需要你查看。')).toBeTruthy();
    expect(screen.queryByText('repair.checkin')).toBeNull();
  });

  it('falls back to user-safe notification time copy when the backend timestamp is missing', async () => {
    mockListNotifications.mockResolvedValueOnce({
      notifications: [{
        ...notification,
        created_at: null,
      }],
      next_cursor: null,
      has_more: false,
    });
    const screen = renderWithQuery(React.createElement(NotificationsScreen));

    expect(await screen.findByText('提醒時間：時間待同步')).toBeTruthy();
  });

  it('registers the native push token after permission is granted', async () => {
    const screen = renderWithQuery(React.createElement(NotificationsScreen));

    expect(await screen.findByText('設備同步')).toBeTruthy();
    expect(screen.queryByText('device token registration / revoke route 尚未存在，不能宣稱已完成推送閉環。')).toBeNull();

    fireEvent.press(await screen.findByText('檢查提醒權限'));

    await waitFor(() => expect(mockRegisterPushTokenForCurrentUser).toHaveBeenCalledWith(
      { platform: 'ios', token: 'ExpoPushToken[test]' },
      '1.3.1-test'
    ));
    expect(await screen.findByText('已同步這台裝置的提醒。')).toBeTruthy();
  });
});
