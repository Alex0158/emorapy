jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    easConfig: null,
    expoConfig: null,
  },
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path, options) => `${path}?${new URLSearchParams(options?.queryParams || {}).toString()}`),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  parse: jest.fn(),
}));

const { Platform } = require('react-native');
const {
  getPushTokenPayload,
  requestPushPermission,
  resolveNotificationLandingTargetFromData,
} = require('./native');

describe('Notification platform adapter', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => originalPlatformOS,
    });
  });

  function setPlatformOS(os) {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => os,
    });
  }

  it('skips native notification side effects on web', async () => {
    setPlatformOS('web');

    await expect(requestPushPermission()).resolves.toEqual({
      canAskAgain: false,
      status: 'undetermined',
    });
    await expect(getPushTokenPayload()).resolves.toBeNull();
  });

  it('resolves notification payload paths to App landing routes', () => {
    expect(resolveNotificationLandingTargetFromData({
      action_key: 'continue_today_step',
      notification_id: 'n1',
      path: '/execution/plan-1/checkin',
    }, 'request-1')).toEqual({
      actionKey: 'continue_today_step',
      href: '/repair',
      notificationId: 'n1',
      requestId: 'request-1',
      sourcePath: '/execution/plan-1/checkin',
    });

    expect(resolveNotificationLandingTargetFromData({
      render_payload: {
        path: '/chat/rooms/room-1',
      },
    })).toEqual({
      href: '/chat/room?roomId=room-1',
      sourcePath: '/chat/rooms/room-1',
    });

    expect(resolveNotificationLandingTargetFromData({
      render_payload: {
        path: '/chat/invite/ABC123',
      },
    })).toEqual({
      href: '/chat/invite?code=ABC123',
      sourcePath: '/chat/invite/ABC123',
    });
  });

  it('falls back safely for malformed or missing paths without treating it as authorization', () => {
    expect(resolveNotificationLandingTargetFromData({
      notificationId: 'n2',
      path: '/admin/users',
    })).toEqual({
      href: '/notifications',
      notificationId: 'n2',
      sourcePath: '/admin/users',
    });

    expect(resolveNotificationLandingTargetFromData({})).toBeNull();
  });
});
