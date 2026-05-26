jest.mock('expo-linking', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  createURL: jest.fn((path, options) => `${path}?${new URLSearchParams(options?.queryParams || {}).toString()}`),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  parse: jest.fn(),
}));

const {
  getInitialAppLandingTarget,
  resolveAppHrefFromBackendPath,
  resolveAppHrefFromUrl,
  subscribeToAppLandingTargets,
} = require('./native');
const Linking = require('expo-linking');

describe('App deep-link resolver', () => {
  it('maps notification backend targets to App routes', () => {
    expect(resolveAppHrefFromBackendPath('/execution/plan-1/checkin')).toBe('/repair');
    expect(resolveAppHrefFromBackendPath('/reconciliation/judgment-1/plan-1')).toBe('/repair');
    expect(resolveAppHrefFromBackendPath('/cases/case-1')).toBe('/case');
    expect(resolveAppHrefFromBackendPath('/judgments/judgment-1')).toBe('/case');
    expect(resolveAppHrefFromBackendPath('/profile/story')).toBe('/profile');
  });

  it('preserves chat room targets when a room id can be inferred', () => {
    expect(resolveAppHrefFromBackendPath('/chat/rooms/room%2F1')).toBe('/chat/room?roomId=room%2F1');
    expect(resolveAppHrefFromBackendPath('/chat/room?roomId=room-2')).toBe('/chat/room?roomId=room-2');
  });

  it('preserves chat invite targets without turning them into accept side effects', () => {
    expect(resolveAppHrefFromBackendPath('/chat/invite/ABC123')).toBe('/chat/invite?code=ABC123');
    expect(resolveAppHrefFromBackendPath('/chat/invites/CODE-01')).toBe('/chat/invite?code=CODE-01');
    expect(resolveAppHrefFromBackendPath('/chat/invite?code=CODE-02')).toBe('/chat/invite?code=CODE-02');
    expect(resolveAppHrefFromBackendPath('/chat/invites/CODE-01/accept')).toBe('/chat');
  });

  it('preserves safe quick child targets without broadening unknown quick paths', () => {
    expect(resolveAppHrefFromBackendPath('/quick/collaborative')).toBe('/quick/collaborative');
    expect(resolveAppHrefFromBackendPath('/quick/result?case_id=case/1')).toBe('/quick/result?caseId=case%2F1');
    expect(resolveAppHrefFromBackendPath('/quick/unknown')).toBe('/quick');
  });

  it('falls back to notifications for unknown or empty paths', () => {
    expect(resolveAppHrefFromBackendPath(null)).toBe('/notifications');
    expect(resolveAppHrefFromBackendPath('/admin/users')).toBe('/notifications');
  });

  it('resolves custom-scheme App deep links without broadening unsafe targets', () => {
    expect(resolveAppHrefFromUrl('cj://case')).toMatchObject({ href: '/case', sourcePath: '/case' });
    expect(resolveAppHrefFromUrl('cj://repair')).toMatchObject({ href: '/repair', sourcePath: '/repair' });
    expect(resolveAppHrefFromUrl('cj://profile/story')).toMatchObject({
      href: '/profile/story',
      sourcePath: '/profile/story',
    });
    expect(resolveAppHrefFromUrl('cj://chat/room?roomId=room-1')).toMatchObject({
      href: '/chat/room?roomId=room-1',
      sourcePath: '/chat/room?roomId=room-1',
    });
    expect(resolveAppHrefFromUrl('cj://chat/invite?code=ABCD')).toMatchObject({
      href: '/chat/invite?code=ABCD',
      sourcePath: '/chat/invite?code=ABCD',
    });
    expect(resolveAppHrefFromUrl('cj://admin/users')).toBeNull();
  });

  it('resolves Expo proxy links and preserves safe public quick targets', () => {
    expect(resolveAppHrefFromUrl('exp://127.0.0.1:8081/--/quick/collaborative')).toMatchObject({
      href: '/quick/collaborative',
      sourcePath: '/quick/collaborative',
    });
    expect(resolveAppHrefFromUrl('exp://127.0.0.1:8081/--/quick/result?case_id=case/1')).toMatchObject({
      href: '/quick/result?caseId=case%2F1',
      sourcePath: '/quick/result?case_id=case/1',
    });
  });

  it('reads initial App landing targets and subscribes to foreground URL events', async () => {
    const remove = jest.fn();
    let listener;
    Linking.getInitialURL.mockResolvedValueOnce('cj://notifications');
    Linking.addEventListener.mockImplementationOnce((_eventName, nextListener) => {
      listener = nextListener;
      return { remove };
    });

    await expect(getInitialAppLandingTarget()).resolves.toMatchObject({
      href: '/notifications',
      sourcePath: '/notifications',
    });

    const onTarget = jest.fn();
    const cleanup = await subscribeToAppLandingTargets(onTarget);
    listener({ url: 'cj://profile/interview?sessionId=session-1' });

    expect(onTarget).toHaveBeenCalledWith(expect.objectContaining({
      href: '/profile/interview?sessionId=session-1',
      sourcePath: '/profile/interview?sessionId=session-1',
    }));
    cleanup();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
