const React = require('react');
const { Text } = require('react-native');
const { act, render, waitFor } = require('@testing-library/react-native');

let mockLifecycleStatus = 'active';
let mockLifecycleListener = null;
const mockSubscribeLifecycle = jest.fn((listener) => {
  mockLifecycleListener = listener;
  return jest.fn();
});

jest.mock('@/src/platform/lifecycle/native', () => ({
  getCurrentLifecycleStatus: () => mockLifecycleStatus,
  subscribeLifecycle: (listener) => mockSubscribeLifecycle(listener),
}));

const { useAIStreamSubscription } = require('./useAIStreamSubscription');
const { setLocale } = require('@/src/i18n');

function StreamProbe({ connect, onConnectionError }) {
  const stream = useAIStreamSubscription({
    scopeKey: 'interview_session:test-session',
    initialState: { text: '', status: 'idle' },
    connect,
    reduceEvent: (prev, event) => ({
      text: event.fullText ?? `${prev.text}${event.deltaText ?? ''}`,
      status: event.eventType,
    }),
    hasRecoverableState: (state) => state.text.length > 0 && state.status !== 'stream.persisted',
    shouldClearRecoveringOnEvent: (event) => event.eventType === 'stream.delta' || event.eventType === 'stream.persisted',
    onConnectionError,
    getRetryDelayMs: () => 1,
  });

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Text, { testID: 'stream.text' }, stream.state.text || 'empty'),
    React.createElement(Text, { testID: 'stream.seq' }, String(stream.lastSeq)),
    React.createElement(Text, { testID: 'stream.recovering' }, stream.isRecovering ? 'recovering' : 'idle'),
    React.createElement(Text, { testID: 'stream.lifecycle' }, stream.lifecycleStatus)
  );
}

describe('useAIStreamSubscription lifecycle recovery', () => {
  beforeEach(() => {
    mockLifecycleStatus = 'active';
    mockLifecycleListener = null;
    mockSubscribeLifecycle.mockClear();
    setLocale('zh-TW', { persist: false });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('aborts background streams and reconnects from last seq when foregrounded', async () => {
    const connections = [];
    const connect = jest.fn((callbacks, options) => {
      connections.push({ callbacks, options });
      return new Promise(() => undefined);
    });

    const screen = render(React.createElement(StreamProbe, { connect }));

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(connections[0].options.afterSeq).toBeUndefined();
    expect(screen.getByTestId('stream.lifecycle').props.children).toBe('active');

    act(() => {
      connections[0].callbacks.onEvent({
        eventType: 'stream.delta',
        seq: 3,
        deltaText: 'hello',
      });
    });

    await waitFor(() => expect(screen.getByTestId('stream.seq').props.children).toBe('3'));
    expect(screen.getByTestId('stream.text').props.children).toBe('hello');

    act(() => {
      mockLifecycleStatus = 'background';
      mockLifecycleListener('background');
    });

    await waitFor(() => expect(screen.getByTestId('stream.recovering').props.children).toBe('recovering'));
    expect(screen.getByTestId('stream.lifecycle').props.children).toBe('background');
    expect(connections[0].options.signal.aborted).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);

    act(() => {
      mockLifecycleStatus = 'active';
      mockLifecycleListener('active');
    });

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(2));
    expect(connections[1].options.afterSeq).toBe(3);
    expect(connections[1].options.signal.aborted).toBe(false);

    act(() => {
      connections[1].callbacks.onEvent({
        eventType: 'stream.delta',
        seq: 4,
        deltaText: ' again',
      });
    });

    await waitFor(() => expect(screen.getByTestId('stream.seq').props.children).toBe('4'));
    expect(screen.getByTestId('stream.text').props.children).toBe('hello again');
    expect(screen.getByTestId('stream.recovering').props.children).toBe('idle');
  });

  it('localizes the default disconnected fallback for non-error stream failures', async () => {
    const onConnectionError = jest.fn();
    const connect = jest.fn(() => Promise.reject('socket closed'));

    render(React.createElement(StreamProbe, { connect, onConnectionError }));

    await waitFor(() => expect(onConnectionError).toHaveBeenCalledWith({
      code: 'STREAM_DISCONNECTED',
      message: '串流連線中斷，正在嘗試重新連線。',
    }));
  });

  it('localizes fixed disconnected Error messages using the current locale', async () => {
    setLocale('en-US', { persist: false });
    const onConnectionError = jest.fn();
    const connect = jest.fn(() => Promise.reject(new Error('SSE stream disconnected')));

    render(React.createElement(StreamProbe, { connect, onConnectionError }));

    await waitFor(() => expect(onConnectionError).toHaveBeenCalledWith({
      code: 'STREAM_DISCONNECTED',
      message: 'The stream connection was interrupted. Reconnecting now.',
    }));
  });

  it('does not expose raw runtime Error messages for stream failures', async () => {
    setLocale('en-US', { persist: false });
    const onConnectionError = jest.fn();
    const connect = jest.fn(() => Promise.reject(new Error('provider down')));

    render(React.createElement(StreamProbe, { connect, onConnectionError }));

    await waitFor(() => expect(onConnectionError).toHaveBeenCalledWith({
      code: 'STREAM_DISCONNECTED',
      message: 'The stream connection was interrupted. Reconnecting now.',
    }));
  });
});
