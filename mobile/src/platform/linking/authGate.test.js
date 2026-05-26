const {
  buildAuthHrefForPostLogin,
  getPostAuthResumeHref,
  getSafeAppLandingHref,
  requiresAuthForAppLandingHref,
} = require('./authGate');

describe('app landing auth gate', () => {
  it('accepts only app landing hrefs', () => {
    expect(getSafeAppLandingHref('/repair')).toBe('/repair');
    expect(getSafeAppLandingHref('/chat/room?roomId=room-1')).toBe('/chat/room?roomId=room-1');
    expect(getSafeAppLandingHref('https://evil.example/case')).toBeNull();
    expect(getSafeAppLandingHref('//evil.example/case')).toBeNull();
    expect(getSafeAppLandingHref('/admin/users')).toBeNull();
  });

  it('marks notification targets as auth-required but keeps public routes public', () => {
    expect(requiresAuthForAppLandingHref('/case')).toBe(true);
    expect(requiresAuthForAppLandingHref('/notifications')).toBe(true);
    expect(requiresAuthForAppLandingHref('/quick')).toBe(false);
    expect(requiresAuthForAppLandingHref('/auth')).toBe(false);
  });

  it('builds auth resume hrefs only for protected app routes', () => {
    expect(getPostAuthResumeHref('/profile/story')).toBe('/profile/story');
    expect(getPostAuthResumeHref('/quick')).toBeNull();
    expect(buildAuthHrefForPostLogin('/profile/story')).toBe('/auth?next=%2Fprofile%2Fstory');
    expect(buildAuthHrefForPostLogin('/admin/users')).toBe('/auth');
  });
});
