const React = require('react');
const { render, waitFor } = require('@testing-library/react-native');

const mockRouterPush = jest.fn();
const mockGetLastNotificationLandingTarget = jest.fn();
const mockGetToken = jest.fn();
const mockSetPendingHref = jest.fn();
let activeListener = null;
const mockSubscribeToNotificationLandingTargets = jest.fn(async (listener) => {
  activeListener = listener;
  return () => {
    activeListener = null;
  };
});
const mockCaptureTelemetry = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock('@/src/platform/notifications/native', () => ({
  getLastNotificationLandingTarget: mockGetLastNotificationLandingTarget,
  subscribeToNotificationLandingTargets: mockSubscribeToNotificationLandingTargets,
}));

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: mockCaptureTelemetry,
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  pendingLandingStorage: {
    setPendingHref: mockSetPendingHref,
  },
  tokenStorage: {
    getToken: mockGetToken,
  },
}));

const { NotificationLandingHandler } = require('./NotificationLandingHandler');

describe('NotificationLandingHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeListener = null;
    mockGetToken.mockResolvedValue('jwt-token');
    mockSetPendingHref.mockResolvedValue(undefined);
    mockGetLastNotificationLandingTarget.mockResolvedValue(null);
  });

  it('opens the last notification response on cold start', async () => {
    mockGetLastNotificationLandingTarget.mockResolvedValueOnce({
      href: '/repair',
      notificationId: 'n1',
      requestId: 'request-1',
      sourcePath: '/execution/plan-1/checkin',
    });

    render(React.createElement(NotificationLandingHandler));

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/repair'));
    expect(mockCaptureTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        notificationId: 'n1',
        source: 'cold_start',
        targetHref: '/repair',
      }),
      name: 'notification_landing_open',
    }));
  });

  it('opens response targets and dedupes the same notification target', async () => {
    render(React.createElement(NotificationLandingHandler));
    await waitFor(() => expect(mockSubscribeToNotificationLandingTargets).toHaveBeenCalledTimes(1));

    activeListener({
      href: '/chat/room?roomId=room-1',
      notificationId: 'n2',
      requestId: 'request-2',
      sourcePath: '/chat/rooms/room-1',
    });
    activeListener({
      href: '/chat/room?roomId=room-1',
      notificationId: 'n2',
      requestId: 'request-2',
      sourcePath: '/chat/rooms/room-1',
    });

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1));
    expect(mockRouterPush).toHaveBeenCalledWith('/chat/room?roomId=room-1');
  });

  it('defers protected notification targets to auth when no token exists', async () => {
    mockGetToken.mockResolvedValueOnce(null);
    mockGetLastNotificationLandingTarget.mockResolvedValueOnce({
      href: '/notifications',
      notificationId: 'n3',
      requestId: 'request-3',
      sourcePath: '/notifications',
    });

    render(React.createElement(NotificationLandingHandler));

    await waitFor(() => expect(mockSetPendingHref).toHaveBeenCalledWith('/notifications'));
    expect(mockRouterPush).toHaveBeenCalledWith('/auth?next=%2Fnotifications');
    expect(mockCaptureTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        notificationId: 'n3',
        targetHref: '/notifications',
      }),
      name: 'notification_landing_deferred',
      route: '/auth',
    }));
  });
});
