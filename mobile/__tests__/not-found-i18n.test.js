const React = require('react');
const { render } = require('@testing-library/react-native');

const mockStackScreen = jest.fn(() => null);

jest.mock('expo-router', () => ({
  Link: ({ children }) => {
    const ReactInMock = require('react');
    return ReactInMock.createElement(ReactInMock.Fragment, null, children);
  },
  Stack: {
    Screen: (props) => mockStackScreen(props),
  },
}));

const { setLocale } = require('@/src/i18n');
const NotFoundScreen = require('../app/+not-found').default;

describe('App not-found i18n', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
  });

  it('renders unknown route fallback in zh-TW', () => {
    const screen = render(React.createElement(NotFoundScreen));

    expect(screen.getByText('這個頁面不存在。')).toBeTruthy();
    expect(screen.getByText('回到首頁')).toBeTruthy();
    expect(mockStackScreen).toHaveBeenCalledWith(
      expect.objectContaining({ options: { title: '找不到頁面' } })
    );
  });

  it('renders unknown route fallback in en-US', () => {
    setLocale('en-US', { persist: false });
    const screen = render(React.createElement(NotFoundScreen));

    expect(screen.getByText("This screen doesn't exist.")).toBeTruthy();
    expect(screen.getByText('Go to home screen')).toBeTruthy();
    expect(mockStackScreen).toHaveBeenCalledWith(
      expect.objectContaining({ options: { title: 'Page not found' } })
    );
  });
});
