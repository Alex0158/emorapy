const mockCreateM3ApiClient = jest.fn(() => ({ marker: 'm3-api' }));
const mockConnectAppSSE = jest.fn();

jest.mock('@emorapy/api-client', () => ({
  chatRoomPath: (roomId, suffix = '') => `/chat/rooms/${encodeURIComponent(roomId)}${suffix}`,
  createM3ApiClient: mockCreateM3ApiClient,
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

const { connectChatAIStream, connectChatRoomStream, m3Api, normalizeM3Error } = require('./api');

describe('M3 feature API adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('binds M3 shared client to the App API adapter', () => {
    expect(m3Api).toEqual({ marker: 'm3-api' });
  });

  it('parses chat stream ready, message, and ping messages', async () => {
    const onReady = jest.fn();
    const onEvent = jest.fn();
    mockConnectAppSSE.mockImplementationOnce(async (options) => {
      options.onMessage({ event: 'ready', data: JSON.stringify({ roomId: 'room/a' }) });
      options.onMessage({
        event: 'message',
        data: JSON.stringify({ type: 'raw', roomId: 'room/a', payload: { messageId: 'm1' } }),
      });
      options.onMessage({ event: 'ping', data: '{}' });
    });

    await connectChatRoomStream('room/a', { onReady, onEvent });

    expect(mockConnectAppSSE).toHaveBeenCalledWith(expect.objectContaining({
      path: '/chat/rooms/room%2Fa/stream',
    }));
    expect(onReady).toHaveBeenCalledWith({ roomId: 'room/a' });
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'message',
      roomId: 'room/a',
      payload: { messageId: 'm1' },
    }));
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('parses chat AI stream ready and event messages with after_seq replay', async () => {
    const onReady = jest.fn();
    const onEvent = jest.fn();
    mockConnectAppSSE.mockImplementationOnce(async (options) => {
      options.onMessage({
        event: 'ready',
        data: JSON.stringify({ scopeType: 'chat_room', scopeId: 'room/a', snapshots: [{ streamId: 's1', lastSeq: 3 }] }),
      });
      options.onMessage({
        event: 'stream.delta',
        data: JSON.stringify({
          eventType: 'stream.delta',
          streamId: 's1',
          requestId: 'req-1',
          scopeType: 'chat_room',
          scopeId: 'room/a',
          seq: 4,
          createdAt: 'now',
          deltaText: 'hello',
        }),
      });
    });

    await connectChatAIStream('room/a', { onReady, onEvent }, { afterSeq: 3 });

    expect(mockConnectAppSSE).toHaveBeenCalledWith(expect.objectContaining({
      afterSeq: 3,
      path: '/streams/chat_room/room%2Fa',
    }));
    expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ scopeId: 'room/a' }));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ deltaText: 'hello', seq: 4 }));
  });

  it('normalizes App API errors for chat screens', () => {
    expect(normalizeM3Error({ code: 'FORBIDDEN', message: 'no' })).toEqual({
      code: 'FORBIDDEN',
      message: 'no',
    });
  });
});
