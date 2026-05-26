const mockCreateM2ApiClient = jest.fn(() => ({ marker: 'm2-api' }));
const mockConnectAppSSE = jest.fn();

jest.mock('@cj/api-client', () => ({
  createM2ApiClient: mockCreateM2ApiClient,
}), { virtual: true });

jest.mock('@/src/platform/api/client', () => ({
  appApiClient: {
    instance: { marker: 'axios' },
    normalizeError: (error) => ({
      code: error?.code || 'APP_ERROR',
      message: error?.message || 'failed',
    }),
  },
}));

jest.mock('@/src/platform/sse/client', () => ({
  connectAppSSE: mockConnectAppSSE,
}));

const { connectInterviewStream, m2Api, normalizeM2Error } = require('./api');

describe('M2 feature API adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('binds M2 shared client to the App API adapter', () => {
    expect(m2Api).toEqual({ marker: 'm2-api' });
  });

  it('parses interview stream ready and event messages', async () => {
    const onReady = jest.fn();
    const onEvent = jest.fn();
    mockConnectAppSSE.mockImplementationOnce(async (options) => {
      options.onMessage({
        event: 'ready',
        data: JSON.stringify({ scopeType: 'interview_session', scopeId: 'session/a', snapshots: [] }),
      });
      options.onMessage({
        event: 'stream.delta',
        data: JSON.stringify({
          eventType: 'stream.delta',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'interview_session',
          scopeId: 'session/a',
          seq: 2,
          createdAt: 'now',
          deltaText: 'hello',
        }),
      });
    });

    await connectInterviewStream('session/a', { onReady, onEvent }, { afterSeq: 1 });

    expect(mockConnectAppSSE).toHaveBeenCalledWith(expect.objectContaining({
      afterSeq: 1,
      path: '/streams/interview_session/session%2Fa',
    }));
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ scopeId: 'session/a' }));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ deltaText: 'hello', seq: 2 }));
  });

  it('normalizes App API errors for profile/interview screens', () => {
    expect(normalizeM2Error({ code: 'FORBIDDEN', message: 'no' })).toEqual({
      code: 'FORBIDDEN',
      message: 'no',
    });
  });
});
