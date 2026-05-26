const SecureStore = require('expo-secure-store');

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

const {
  clearAppStorage,
  getDeviceMetadata,
  pendingLandingStorage,
  sessionStorage,
  setDeviceMetadata,
  tokenStorage,
} = require('./secureStore');

describe('SecureStore platform adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores and clears auth token and anonymous session id', async () => {
    await tokenStorage.setToken('jwt-token');
    await sessionStorage.setSessionId('guest-session');
    await pendingLandingStorage.setPendingHref('/repair');
    await tokenStorage.setToken(null);
    await sessionStorage.clearSessionId();
    await pendingLandingStorage.clearPendingHref();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('cj.auth.token', 'jwt-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('cj.session.id', 'guest-session');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('cj.navigation.pendingLandingHref', '/repair');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.auth.token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.session.id');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.navigation.pendingLandingHref');
  });

  it('consumes pending landing href after post-login resume', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('/notifications');
    await expect(pendingLandingStorage.consumePendingHref()).resolves.toBe('/notifications');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.navigation.pendingLandingHref');
  });

  it('round-trips device metadata and deletes malformed metadata', async () => {
    await setDeviceMetadata({ platform: 'ios', installationId: 'install-1' });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'cj.device.meta',
      JSON.stringify({ platform: 'ios', installationId: 'install-1' })
    );

    SecureStore.getItemAsync.mockResolvedValueOnce('{"platform":"ios","appVersion":"1.0.0"}');
    await expect(getDeviceMetadata()).resolves.toEqual({ platform: 'ios', appVersion: '1.0.0' });

    SecureStore.getItemAsync.mockResolvedValueOnce('{broken');
    await expect(getDeviceMetadata()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.device.meta');
  });

  it('clears all app-local credentials together', async () => {
    await clearAppStorage();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.auth.token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.session.id');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.device.meta');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('cj.navigation.pendingLandingHref');
  });

  it('falls back to in-memory storage when SecureStore native methods are unavailable', async () => {
    jest.resetModules();
    jest.doMock('expo-secure-store', () => ({}));
    const { tokenStorage: fallbackTokenStorage } = require('./secureStore');

    await fallbackTokenStorage.setToken('web-token');
    await expect(fallbackTokenStorage.getToken()).resolves.toBe('web-token');
    await fallbackTokenStorage.clearToken();
    await expect(fallbackTokenStorage.getToken()).resolves.toBeNull();
  });

  it('falls back to in-memory storage when SecureStore methods throw at runtime', async () => {
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('native unavailable'));
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error('native unavailable'));
    SecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('native unavailable'));

    await tokenStorage.setToken('runtime-web-token');
    await expect(tokenStorage.getToken()).resolves.toBe('runtime-web-token');
    await tokenStorage.clearToken();
    await expect(tokenStorage.getToken()).resolves.toBeNull();
  });
});
