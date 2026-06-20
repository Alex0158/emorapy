const mockCreateM4ApiClient = jest.fn(() => ({ marker: 'm4-api' }));
const mockConnectAppSSE = jest.fn();

jest.mock('@emorapy/api-client', () => ({
  createM4ApiClient: mockCreateM4ApiClient,
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

const { connectRepairTrackStream, m4Api, normalizeM4Error } = require('./api');

describe('M4 feature API adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('binds M4 shared client to the App API adapter', () => {
    expect(m4Api).toEqual({ marker: 'm4-api' });
  });

  it('normalizes App API errors for formal case and repair screens', () => {
    expect(normalizeM4Error({ code: 'FORBIDDEN', message: 'no' })).toEqual({
      code: 'FORBIDDEN',
      message: 'no',
    });
  });

  it('parses repair track stream ready and event messages with after_seq replay', async () => {
    const onReady = jest.fn();
    const onEvent = jest.fn();
    mockConnectAppSSE.mockImplementationOnce(async (options) => {
      options.onMessage({
        event: 'ready',
        data: JSON.stringify({
          scopeType: 'repair_track',
          scopeId: 'track/a',
          snapshots: [{ streamId: 's1', lastSeq: 5 }],
        }),
      });
      options.onMessage({
        event: 'stream.delta',
        data: JSON.stringify({
          eventType: 'stream.delta',
          streamId: 's1',
          requestId: 'req-1',
          scopeType: 'repair_track',
          scopeId: 'track/a',
          seq: 6,
          createdAt: 'now',
          deltaText: 'lower pressure',
          metadata: { task_type: 'repair_replan' },
        }),
      });
    });

    await connectRepairTrackStream('track/a', { onReady, onEvent }, { afterSeq: 5 });

    expect(mockConnectAppSSE).toHaveBeenCalledWith(expect.objectContaining({
      afterSeq: 5,
      path: '/streams/repair_track/track%2Fa',
    }));
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ scopeId: 'track/a' }));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ deltaText: 'lower pressure', seq: 6 }));
  });
});
