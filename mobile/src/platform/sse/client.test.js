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

jest.mock('@emorapy/api-client', () => ({
  readApiResponseError: (data) => data?.error ?? {},
  statusToRequestCode: (status) => `HTTP_${status}`,
  statusToRequestMessage: (status) => `HTTP ${status}`,
  toRequestError: (code, message, details) =>
    details === undefined ? { code, message } : { code, message, details },
}), { virtual: true });

const { setLocale } = require('@/src/i18n');
const { connectAppSSE } = require('./client');

describe('App SSE client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
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
          'X-Locale': 'zh-TW',
          'X-Session-Id': 'guest-session',
        }),
      })
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ event: 'ready', data: '{}' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens SSE with the current runtime-selected locale', async () => {
    mockFetchEventSource.mockImplementationOnce(async (_url, options) => {
      await options.onopen({ ok: true });
    });

    setLocale('en-US', { persist: false });

    await connectAppSSE({
      path: '/streams/interview_session/session-1',
      onMessage: jest.fn(),
    });

    expect(mockFetchEventSource).toHaveBeenCalledWith(
      'https://api.test/streams/interview_session/session-1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Locale': 'en-US',
        }),
      })
    );
  });

  it('turns non-2xx stream open responses into typed localized App API errors', async () => {
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
      message: '請先登入後再繼續。',
    });
  });

  it('localizes stream open fallback errors when the backend does not provide a message', async () => {
    mockFetchEventSource.mockImplementationOnce(async (_url, options) => {
      await options.onopen({
        ok: false,
        status: 503,
        json: async () => ({ success: false }),
      });
    });

    await expect(connectAppSSE({
      path: '/streams/interview_session/session-1',
      onMessage: jest.fn(),
    })).rejects.toEqual({
      code: 'HTTP_503',
      message: '服務暫時不可用，請稍後再試。',
    });

    setLocale('en-US', { persist: false });
    mockFetchEventSource.mockImplementationOnce(async (_url, options) => {
      await options.onopen({
        ok: false,
        status: 500,
        json: async () => ({ success: false }),
      });
    });

    await expect(connectAppSSE({
      path: '/streams/interview_session/session-1',
      onMessage: jest.fn(),
    })).rejects.toEqual({
      code: 'HTTP_500',
      message: 'The service could not complete the request. Please try again later.',
    });

    mockFetchEventSource.mockImplementationOnce(async (_url, options) => {
      await options.onopen({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'SERVER_ERROR', message: '服務器錯誤' } }),
      });
    });

    await expect(connectAppSSE({
      path: '/streams/interview_session/session-1',
      onMessage: jest.fn(),
    })).rejects.toEqual({
      code: 'SERVER_ERROR',
      message: 'The service could not complete the request. Please try again later.',
    });
  });
});
