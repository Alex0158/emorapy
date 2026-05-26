const { AppState } = require('react-native');

const { getCurrentLifecycleStatus, subscribeLifecycle } = require('./native');

describe('Lifecycle platform adapter', () => {
  const originalCurrentState = AppState.currentState;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      get: () => originalCurrentState,
    });
  });

  it('reads the current native lifecycle status through the adapter', () => {
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      get: () => 'active',
    });

    expect(getCurrentLifecycleStatus()).toBe('active');
  });

  it('subscribes and removes AppState listeners through the adapter', () => {
    const remove = jest.fn();
    const listener = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });

    const unsubscribe = subscribeLifecycle(listener);

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', listener);
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
