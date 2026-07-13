const React = require('react');
const { Text } = require('react-native');
const { act, render, waitFor } = require('@testing-library/react-native');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');

const mockGetToken = jest.fn();
const mockGetSessionId = jest.fn();

jest.mock('@/src/platform/storage/secureStore', () => ({
  sessionStorage: {
    getSessionId: mockGetSessionId,
  },
  tokenStorage: {
    getToken: mockGetToken,
  },
}));

jest.mock('./ObservabilityBootstrap', () => ({
  ObservabilityBootstrap: () => null,
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  return {
    MD3LightTheme: {},
    PaperProvider: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

const {
  APP_AUTH_TOKEN_QUERY_KEY,
  APP_SESSION_ID_QUERY_KEY,
} = require('./AuthSessionBootstrap');
const { AuthSessionBootstrap } = require('./AuthSessionBootstrap');
const { AppProviders } = require('./AppProviders');
const {
  beginIdentityQueryTransition,
  completeIdentityQueryTransition,
} = require('./identityQueryScope');

function CacheProbe() {
  return React.createElement(
    Text,
    { testID: 'cache-probe' },
    'provider-child'
  );
}

describe('AppProviders auth/session bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('jwt-token');
    mockGetSessionId.mockResolvedValue('guest-session');
  });

  it('renders provider children', () => {
    const screen = render(
      React.createElement(
        AppProviders,
        null,
        React.createElement(CacheProbe)
      )
    );

    expect(screen.getByTestId('cache-probe')).toBeTruthy();
    screen.unmount();
  });

  it('preloads auth/session cache from storage', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { gcTime: Infinity, retry: false },
        mutations: { gcTime: Infinity, retry: false },
      },
    });
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(AuthSessionBootstrap)
      )
    );

    await waitFor(() => {
      expect(queryClient.getQueryData(APP_AUTH_TOKEN_QUERY_KEY)).toBe('jwt-token');
      expect(queryClient.getQueryData(APP_SESSION_ID_QUERY_KEY)).toBe('guest-session');
    });
    queryClient.clear();
  });

  it('does not let a stale bootstrap response overwrite a newer identity transition', async () => {
    let resolveToken;
    let resolveSession;
    mockGetToken.mockImplementationOnce(() => new Promise((resolve) => { resolveToken = resolve; }));
    mockGetSessionId.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve; }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { gcTime: Infinity, retry: false },
        mutations: { gcTime: Infinity, retry: false },
      },
    });
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(AuthSessionBootstrap)
      )
    );

    await waitFor(() => {
      expect(mockGetToken).toHaveBeenCalledTimes(1);
      expect(mockGetSessionId).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      const epoch = await beginIdentityQueryTransition(queryClient);
      queryClient.setQueryData(APP_AUTH_TOKEN_QUERY_KEY, 'account-b-token');
      queryClient.setQueryData(APP_SESSION_ID_QUERY_KEY, 'account-b-session');
      completeIdentityQueryTransition(queryClient, epoch, { privateDataEnabled: true });
      resolveToken('late-account-a-token');
      resolveSession('late-account-a-session');
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(APP_AUTH_TOKEN_QUERY_KEY)).toBe('account-b-token');
    expect(queryClient.getQueryData(APP_SESSION_ID_QUERY_KEY)).toBe('account-b-session');
    queryClient.clear();
  });
});
