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

  it('localizes fallback transport errors when the backend does not provide a message', () => {
    const client = createAppApiClient();

    expect(client.normalizeError({
      isAxiosError: true,
      response: { status: 404, data: { success: false } },
    })).toMatchObject({
      code: 'HTTP_404',
      message: '找不到這項資料，可能已過期或被移除。',
    });

    expect(client.normalizeError({
      isAxiosError: true,
    })).toMatchObject({
      code: 'NETWORK_ERROR',
      message: '網路連線失敗，請檢查連線後再試。',
    });

    expect(client.normalizeError({ reason: 'unexpected' })).toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: '發生未知錯誤，請稍後再試。',
    });

    setLocale('en-US', { persist: false });

    expect(client.normalizeError({
      isAxiosError: true,
      response: { status: 429, data: { success: false } },
    })).toMatchObject({
      code: 'HTTP_429',
      message: 'Too many actions. Please try again later.',
    });
  });

  it('localizes shared-client invalid response fallback errors without overriding backend messages', () => {
    const client = createAppApiClient();

    expect(client.normalizeError({
      code: 'INVALID_CASE_RESPONSE',
      message: 'Invalid case response from server',
      details: { field: 'case' },
    })).toEqual({
      code: 'INVALID_CASE_RESPONSE',
      message: '服務回應格式異常，請稍後再試。',
      details: { field: 'case' },
    });

    expect(client.normalizeError({
      code: 'INVALID_AUTH_TOKEN',
      message: '登入憑證已失效，請重新登入。',
    })).toEqual({
      code: 'INVALID_AUTH_TOKEN',
      message: '登入憑證已失效，請重新登入。',
    });

    setLocale('en-US', { persist: false });

    expect(client.normalizeError({
      code: 'INVALID_PROFILE_RESPONSE',
      message: 'Invalid profile response from server',
    })).toEqual({
      code: 'INVALID_PROFILE_RESPONSE',
      message: 'The service response could not be read. Please try again later.',
    });
  });
});
