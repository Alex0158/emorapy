const React = require('react');
const { fireEvent, render } = require('@testing-library/react-native');

const mockCaptureTelemetry = jest.fn();

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: mockCaptureTelemetry,
}));

jest.mock('expo-router', () => ({
  Link: ({ children }) => {
    const React = require('react');
    return React.createElement(React.Fragment, null, children);
  },
}));

const { AppErrorBoundary } = require('./AppErrorBoundary');

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders safe recovery copy without exposing raw error details', () => {
    const retry = jest.fn(() => Promise.resolve());
    const screen = render(
      React.createElement(AppErrorBoundary, {
        error: new Error('secret token leaked'),
        retry,
      })
    );

    expect(screen.getByText('暫時無法載入')).toBeTruthy();
    expect(screen.getByText('恢復方式')).toBeTruthy();
    expect(screen.queryByText('secret token leaked')).toBeNull();
    expect(mockCaptureTelemetry).toHaveBeenCalledWith({
      name: 'app_error_boundary',
      severity: 'error',
      route: '/app',
      context: {
        errorName: 'Error',
        hasMessage: true,
      },
    });

    fireEvent.press(screen.getByText('重新嘗試'));

    expect(retry).toHaveBeenCalledTimes(1);
    screen.unmount();
  });
});
