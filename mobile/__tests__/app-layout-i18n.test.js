const React = require('react');
const { render } = require('@testing-library/react-native');

const renderedScreens = [];

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const Tabs = ({ children }) => React.createElement(React.Fragment, null, children);
  Tabs.Screen = ({ name, options }) => {
    renderedScreens.push({ name, options });
    return null;
  };
  return { Tabs };
});

const AppLayout = require('../app/(app)/_layout').default;
const { setLocale } = require('@/src/i18n');

describe('App tab layout i18n', () => {
  beforeEach(() => {
    renderedScreens.length = 0;
    setLocale('zh-TW', { persist: false });
  });

  it('renders tab titles in the selected locale', () => {
    setLocale('en-US', { persist: false });
    render(React.createElement(AppLayout));

    expect(renderedScreens).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'case/index',
        options: expect.objectContaining({ title: 'Cases' }),
      }),
      expect.objectContaining({
        name: 'chat/index',
        options: expect.objectContaining({ title: 'Chat' }),
      }),
      expect.objectContaining({
        name: 'profile/index',
        options: expect.objectContaining({ title: 'Profile' }),
      }),
      expect.objectContaining({
        name: 'notifications/index',
        options: expect.objectContaining({ title: 'Alerts' }),
      }),
      expect.objectContaining({
        name: 'repair/index',
        options: expect.objectContaining({ title: 'Repair' }),
      }),
    ]));
  });
});
