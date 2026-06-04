const SecureStore = require('expo-secure-store');

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/src/config/runtime', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: 'https://api.test',
    locale: 'zh-Hant',
    requestTimeoutMs: 4321,
  }),
}));

jest.mock('@cj/api-client', () => ({
  readApiResponseError: (data) => data?.error ?? {},
  statusToRequestCode: (status) => `HTTP_${status}`,
  statusToRequestMessage: (status) => `HTTP ${status}`,
  toRequestError: (code, message, details) =>
    details === undefined ? { code, message } : { code, message, details },
}), { virtual: true });

const { setLocale } = require('@/src/i18n');
const { createAppApiClient } = require('./client');

describe('App API platform adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'cj.auth.token') return Promise.resolve('jwt-token');
      if (key === 'cj.session.id') return Promise.resolve('guest-session');
      return Promise.resolve(null);
    });
  });

  it('adds auth, session, locale, request id, and JSON headers', async () => {
    const client = createAppApiClient();
    client.instance.defaults.adapter = async (config) => ({
      config,
      data: { ok: true },
      headers: {},
      status: 200,
      statusText: 'OK',
    });

    const response = await client.instance.post('/cases/quick', { plaintiff_statement: 'hello' });
    const headers = response.config.headers;

    expect(headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(headers.get('X-Session-Id')).toBe('guest-session');
    expect(headers.get('X-Locale')).toBe('zh-TW');
    expect(headers.get('X-Request-Id')).toMatch(/^app-/);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('uses the current runtime-selected locale for request headers', async () => {
    const client = createAppApiClient();
    client.instance.defaults.adapter = async (config) => ({
      config,
      data: { ok: true },
      headers: {},
      status: 200,
      statusText: 'OK',
    });

    setLocale('en-US', { persist: false });
    const response = await client.instance.get('/version');

    expect(response.config.headers.get('X-Locale')).toBe('en-US');
  });

  it('normalizes axios envelope errors and plain app errors', () => {
    const client = createAppApiClient();
    const envelope = client.normalizeError({
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          success: false,
          error: { code: 'AUTH_REQUIRED', message: '需要登入', details: { path: '/case' } },
        },
      },
    });

    expect(envelope).toEqual({
      code: 'AUTH_REQUIRED',
      message: '需要登入',
      details: { path: '/case' },
    });

    expect(client.normalizeError(new Error('local failure'))).toMatchObject({
      code: 'APP_ERROR',
      message: 'local failure',
    });
  });
});
