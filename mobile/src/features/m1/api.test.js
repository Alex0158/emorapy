const mockCreateM1ApiClient = jest.fn(() => ({ marker: 'm1-api' }));
const mockConnectAppSSE = jest.fn();

jest.mock('@cj/api-client', () => ({
  createM1ApiClient: mockCreateM1ApiClient,
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

const { connectQuickJudgmentStream, m1Api, normalizeM1Error } = require('./api');

describe('M1 feature API adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('binds M1 shared client to the App API adapter', () => {
    expect(m1Api).toEqual({ marker: 'm1-api' });
  });

  it('parses quick judgment stream ready and event messages with after_seq replay', async () => {
    const onReady = jest.fn();
    const onEvent = jest.fn();
    mockConnectAppSSE.mockImplementationOnce(async (options) => {
      options.onMessage({
        event: 'ready',
        data: JSON.stringify({
          scopeType: 'case_judgment',
          scopeId: 'case/a',
          snapshots: [{ streamId: 'stream-1', lastSeq: 3 }],
        }),
      });
      options.onMessage({
        event: 'stream.persisted',
        data: JSON.stringify({
          eventType: 'stream.persisted',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'case_judgment',
          scopeId: 'case/a',
          seq: 4,
          createdAt: 'now',
          metadata: { judgmentId: 'judgment-1' },
        }),
      });
    });

    await connectQuickJudgmentStream('case/a', { onReady, onEvent }, { afterSeq: 3 });

    expect(mockConnectAppSSE).toHaveBeenCalledWith(expect.objectContaining({
      afterSeq: 3,
      path: '/streams/case_judgment/case%2Fa',
    }));
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ scopeId: 'case/a' }));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'stream.persisted',
      seq: 4,
    }));
  });

  it('normalizes App API errors for quick/auth screens', () => {
    expect(normalizeM1Error({ code: 'FORBIDDEN', message: 'no' })).toEqual({
      code: 'FORBIDDEN',
      message: 'no',
    });
  });
});
