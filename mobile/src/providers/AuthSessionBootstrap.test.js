const React = require('react');
const { Text } = require('react-native');
const { render, waitFor } = require('@testing-library/react-native');
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
});
