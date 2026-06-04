const React = require('react');
const { fireEvent, render } = require('@testing-library/react-native');
const { ScrollView, StyleSheet, Text } = require('react-native');

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
}));

const { setLocale } = require('@/src/i18n');
const { ActionButton, FeatureRow, LinkButton, Panel, Screen } = require('./components');

function flattenPressableStyle(element, state = { pressed: false }) {
  const style = typeof element.props.style === 'function'
    ? element.props.style(state)
    : element.props.style;
  return StyleSheet.flatten(style);
}

describe('shared App UI accessibility contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
  });

  it('marks screen and panel titles as accessibility headers', () => {
    const screen = render(
      React.createElement(
        Screen,
        { title: '把拉扯整理成下一步', subtitle: '先整理事實。' },
        React.createElement(
          Panel,
          { title: '今日入口' },
          React.createElement(Text, null, '內容')
        )
      )
    );

    expect(screen.getByText('把拉扯整理成下一步').props.accessibilityRole).toBe('header');
    expect(screen.getByText('今日入口').props.accessibilityRole).toBe('header');
  });

  it('keeps form actions tappable while the keyboard is open', () => {
    const screen = render(
      React.createElement(
        Screen,
        { title: '快速整理' },
        React.createElement(Text, null, '內容')
      )
    );
    const scrollView = screen.UNSAFE_getByType(ScrollView);

    expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scrollView.props.keyboardDismissMode).toBe('interactive');
  });

  it('keeps link buttons navigable, labelled, hinted, and large enough to tap', () => {
    const screen = render(
      React.createElement(LinkButton, {
        href: '/quick',
        label: '開始快速判斷',
        accessibilityHint: '前往匿名快速判斷表單',
        testID: 'cta.quick',
      })
    );
    const button = screen.getByTestId('cta.quick');
    const style = flattenPressableStyle(button);

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('開始快速判斷');
    expect(button.props.accessibilityHint).toBe('前往匿名快速判斷表單');
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.borderRadius).toBeLessThanOrEqual(8);

    fireEvent.press(button);

    expect(mockRouterPush).toHaveBeenCalledWith('/quick');
  });

  it('localizes default button accessibility hints', () => {
    setLocale('en-US', { persist: false });
    const screen = render(
      React.createElement(LinkButton, {
        href: '/quick',
        label: 'Quick',
        testID: 'cta.quick.default-hint',
      })
    );

    expect(screen.getByTestId('cta.quick.default-hint').props.accessibilityHint).toBe('Open "Quick"');
  });

  it('exposes action button busy/disabled state without shrinking the touch target', () => {
    const onPress = jest.fn();
    const screen = render(
      React.createElement(ActionButton, {
        label: '提交',
        loading: true,
        onPress,
        accessibilityHint: '送出目前內容',
        testID: 'action.submit',
      })
    );
    const button = screen.getByTestId('action.submit');
    const style = flattenPressableStyle(button);

    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({
      disabled: true,
      busy: true,
    }));
    expect(button.props.accessibilityHint).toBe('送出目前內容');
    expect(style.minHeight).toBeGreaterThanOrEqual(48);

    fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it('groups feature rows into one screen-reader announcement', () => {
    const screen = render(
      React.createElement(FeatureRow, {
        title: '快速判斷',
        detail: '先在這台裝置保存一次衝突整理。',
        tone: 'teal',
      })
    );

    expect(screen.getByLabelText('快速判斷。先在這台裝置保存一次衝突整理。')).toBeTruthy();
  });
});
