const mockFetchEventSource = jest.fn();
const mockGetToken = jest.fn();
const mockGetSessionId = jest.fn();

jest.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: mockFetchEventSource,
}));

jest.mock('@/src/config/runtime', () => ({
  getRuntimeConfig: () => ({
    apiBaseUrl: 'https://api.test',
    locale: 'zh-Hant',
  }),
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  sessionStorage: {
    getSessionId: mockGetSessionId,
  },
  tokenStorage: {
    getToken: mockGetToken,
  },
}));

jest.mock('@cj/api-client', () => ({
  readApiResponseError: (data) => data?.error ?? {},
  statusToRequestCode: (status) => `HTTP_${status}`,
  statusToRequestMessage: (status) => `HTTP ${status}`,
  toRequestError: (code, message, details) =>
    details === undefined ? { code, message } : { code, message, details },
}), { virtual: true });

const { connectAppSSE } = require('./client');

describe('App SSE client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('jwt-token');
    mockGetSessionId.mockResolvedValue('guest-session');
  });

  it('opens SSE with auth/session headers, locale, after_seq, and close callback', async () => {
    const onOpen = jest.fn();
    const onMessage = jest.fn();
    const onClose = jest.fn();
    mockFetchEventSource.mockImplementationOnce(async (_url, options) => {
      await options.onopen({ ok: true });
      options.onmessage({ event: 'ready', data: '{}' });
      options.onclose();
    });

    await connectAppSSE({
      path: '/streams/interview_session/session-1',
      afterSeq: 7,
      onOpen,
      onMessage,
      onClose,
    });

    expect(mockFetchEventSource).toHaveBeenCalledWith(
      'https://api.test/streams/interview_session/session-1?after_seq=7',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          Authorization: 'Bearer jwt-token',
          'X-Locale': 'zh-Hant',
          'X-Session-Id': 'guest-session',
        }),
      })
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ event: 'ready', data: '{}' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turns non-2xx stream open responses into typed App API errors', async () => {
    mockFetchEventSource.mockImplementationOnce(async (_url, options) => {
      await options.onopen({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'AUTH_REQUIRED', message: '需要登入' } }),
      });
    });

    await expect(connectAppSSE({
      path: '/streams/interview_session/session-1',
      onMessage: jest.fn(),
    })).rejects.toEqual({
      code: 'AUTH_REQUIRED',
      message: '需要登入',
    });
  });
});
