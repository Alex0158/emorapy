const mockRegisterDeviceToken = jest.fn();
const mockRevokeDeviceToken = jest.fn();
const mockClearAppStorage = jest.fn();
const mockGetDeviceMetadata = jest.fn();
const mockSetDeviceMetadata = jest.fn();
const mockCaptureTelemetry = jest.fn();

jest.mock('./api', () => ({
  normalizeM5Error: (error) => ({
    code: error?.code || 'APP_ERROR',
    message: error?.message || 'failed',
  }),
  m5Api: {
    notifications: {
      registerDeviceToken: mockRegisterDeviceToken,
      revokeDeviceToken: mockRevokeDeviceToken,
    },
  },
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  clearAppStorage: mockClearAppStorage,
  getDeviceMetadata: mockGetDeviceMetadata,
  setDeviceMetadata: mockSetDeviceMetadata,
}));

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: mockCaptureTelemetry,
}));

const {
  clearAppStorageWithPushCleanup,
  registerPushTokenForCurrentUser,
  revokeStoredPushToken,
} = require('./pushLifecycle');

describe('M5 push token lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterDeviceToken.mockResolvedValue({ id: 'push-token-1' });
    mockRevokeDeviceToken.mockResolvedValue({ revokedCount: 1 });
    mockClearAppStorage.mockResolvedValue(undefined);
    mockGetDeviceMetadata.mockResolvedValue({
      appVersion: '1.3.1',
      platform: 'ios',
      pushToken: 'ExpoPushToken[test]',
    });
    mockSetDeviceMetadata.mockResolvedValue(undefined);
  });

  it('registers and persists minimal push token metadata', async () => {
    mockGetDeviceMetadata.mockResolvedValueOnce(null);
    const result = await registerPushTokenForCurrentUser(
      { token: 'ExpoPushToken[test]', platform: 'ios' },
      '1.3.1'
    );

    expect(result).toEqual({ id: 'push-token-1' });
    expect(mockRegisterDeviceToken).toHaveBeenCalledWith({
      app_version: '1.3.1',
      platform: 'ios',
      token: 'ExpoPushToken[test]',
    });
    expect(mockSetDeviceMetadata).toHaveBeenCalledWith({
      appVersion: '1.3.1',
      platform: 'ios',
      pushToken: 'ExpoPushToken[test]',
    });
  });

  it('revokes the previous push token before persisting a rotated token', async () => {
    mockGetDeviceMetadata.mockResolvedValueOnce({
      appVersion: '1.3.0',
      platform: 'ios',
      pushToken: 'ExpoPushToken[old]',
    });

    await registerPushTokenForCurrentUser(
      { token: 'ExpoPushToken[new]', platform: 'ios' },
      '1.3.1'
    );

    expect(mockRevokeDeviceToken).toHaveBeenCalledWith({ token: 'ExpoPushToken[old]' });
    expect(mockRegisterDeviceToken).toHaveBeenCalledWith({
      app_version: '1.3.1',
      platform: 'ios',
      token: 'ExpoPushToken[new]',
    });
    expect(mockSetDeviceMetadata).toHaveBeenCalledWith({
      appVersion: '1.3.1',
      platform: 'ios',
      pushToken: 'ExpoPushToken[new]',
    });
  });

  it('continues registering the new token if rotation revoke fails', async () => {
    mockGetDeviceMetadata.mockResolvedValueOnce({
      appVersion: '1.3.0',
      platform: 'ios',
      pushToken: 'ExpoPushToken[old]',
    });
    mockRevokeDeviceToken.mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'offline' });

    await registerPushTokenForCurrentUser(
      { token: 'ExpoPushToken[new]', platform: 'ios' },
      '1.3.1'
    );

    expect(mockRegisterDeviceToken).toHaveBeenCalledWith({
      app_version: '1.3.1',
      platform: 'ios',
      token: 'ExpoPushToken[new]',
    });
    expect(mockCaptureTelemetry).toHaveBeenCalledWith({
      name: 'app_push_token_revoke_failed',
      severity: 'warning',
      context: {
        code: 'NETWORK_ERROR',
        hasPushToken: true,
        platform: 'ios',
        reason: 'rotation',
      },
    });
  });

  it('revokes stored push token before clearing local app storage', async () => {
    await clearAppStorageWithPushCleanup();

    expect(mockRevokeDeviceToken).toHaveBeenCalledWith({ token: 'ExpoPushToken[test]' });
    expect(mockClearAppStorage).toHaveBeenCalledTimes(1);
  });

  it('does not block local cleanup when revoke fails', async () => {
    mockRevokeDeviceToken.mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'offline' });

    const result = await revokeStoredPushToken();
    await clearAppStorageWithPushCleanup();

    expect(result).toEqual({ revoked: false, reason: 'request_failed' });
    expect(mockCaptureTelemetry).toHaveBeenCalledWith({
      name: 'app_push_token_revoke_failed',
      severity: 'warning',
      context: {
        code: 'NETWORK_ERROR',
        hasPushToken: true,
        platform: 'ios',
        reason: 'logout',
      },
    });
    expect(mockClearAppStorage).toHaveBeenCalledTimes(1);
  });
});
