const React = require('react');
const { render, waitFor } = require('@testing-library/react-native');

const mockRouterPush = jest.fn();
const mockGetInitialAppLandingTarget = jest.fn();
const mockGetToken = jest.fn();
const mockSetPendingHref = jest.fn();
let activeListener = null;
const mockSubscribeToAppLandingTargets = jest.fn(async (listener) => {
  activeListener = listener;
  return () => {
    activeListener = null;
  };
});
const mockCaptureTelemetry = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock('@/src/platform/linking/native', () => ({
  getInitialAppLandingTarget: mockGetInitialAppLandingTarget,
  subscribeToAppLandingTargets: mockSubscribeToAppLandingTargets,
}));

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: mockCaptureTelemetry,
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  pendingLandingStorage: {
    setPendingHref: mockSetPendingHref,
  },
  tokenStorage: {
    getToken: mockGetToken,
  },
}));

const { DeepLinkLandingHandler } = require('./DeepLinkLandingHandler');

describe('DeepLinkLandingHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeListener = null;
    mockGetToken.mockResolvedValue('jwt-token');
    mockSetPendingHref.mockResolvedValue(undefined);
    mockGetInitialAppLandingTarget.mockResolvedValue(null);
  });

  it('opens an initial public deep link without requiring auth', async () => {
    mockGetToken.mockResolvedValueOnce(null);
    mockGetInitialAppLandingTarget.mockResolvedValueOnce({
      href: '/quick/collaborative',
      sourcePath: '/quick/collaborative',
      sourceUrl: 'emorapy://quick/collaborative',
    });

    render(React.createElement(DeepLinkLandingHandler));

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/quick/collaborative'));
    expect(mockSetPendingHref).not.toHaveBeenCalled();
    expect(mockCaptureTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        source: 'cold_start',
        targetHref: '/quick/collaborative',
      }),
      name: 'deep_link_landing_open',
    }));
  });

  it('defers initial protected deep links to auth and stores post-login resume target', async () => {
    mockGetToken.mockResolvedValueOnce(null);
    mockGetInitialAppLandingTarget.mockResolvedValueOnce({
      href: '/repair',
      sourcePath: '/repair',
      sourceUrl: 'emorapy://repair',
    });

    render(React.createElement(DeepLinkLandingHandler));

    await waitFor(() => expect(mockSetPendingHref).toHaveBeenCalledWith('/repair'));
    expect(mockRouterPush).toHaveBeenCalledWith('/auth?next=%2Frepair');
    expect(mockCaptureTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        source: 'cold_start',
        targetHref: '/repair',
      }),
      name: 'deep_link_landing_deferred',
      route: '/auth',
    }));
  });

  it('opens foreground URL events and dedupes the same source URL target', async () => {
    render(React.createElement(DeepLinkLandingHandler));
    await waitFor(() => expect(mockSubscribeToAppLandingTargets).toHaveBeenCalledTimes(1));

    activeListener({
      href: '/chat/room?roomId=room-1',
      sourcePath: '/chat/room?roomId=room-1',
      sourceUrl: 'emorapy://chat/room?roomId=room-1',
    });
    activeListener({
      href: '/chat/room?roomId=room-1',
      sourcePath: '/chat/room?roomId=room-1',
      sourceUrl: 'emorapy://chat/room?roomId=room-1',
    });

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledTimes(1));
    expect(mockRouterPush).toHaveBeenCalledWith('/chat/room?roomId=room-1');
  });
});
