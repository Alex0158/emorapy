const React = require('react');
const { fireEvent, render } = require('@testing-library/react-native');

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
}));

const { setLocale } = require('@/src/i18n');
const PublicHomeScreen = require('../app/(public)/index').default;

describe('public App home i18n', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
  });

  it('renders the public entry in zh-TW by default', () => {
    const screen = render(React.createElement(PublicHomeScreen));

    expect(screen.getByText('把拉扯整理成下一步')).toBeTruthy();
    expect(screen.getByText('開始快速判斷')).toBeTruthy();
    expect(screen.getByText('目前語言：繁體中文')).toBeTruthy();
  });

  it('rerenders public entry copy after switching locale', () => {
    const screen = render(React.createElement(PublicHomeScreen));

    fireEvent.press(screen.getByTestId('public.home.locale'));

    expect(screen.getByText('Turn conflict into the next step')).toBeTruthy();
    expect(screen.getByText('Start quick check')).toBeTruthy();
    expect(screen.getByText('Current language: English')).toBeTruthy();
  });
});
