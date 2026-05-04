import { buildBackendVersionManifest } from '../../../src/utils/version';

describe('version utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CJ_COMMIT_SHA;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GITHUB_SHA;
    delete process.env.SOURCE_VERSION;
    delete process.env.COMMIT_SHA;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('優先使用 CJ_COMMIT_SHA', () => {
    process.env.CJ_COMMIT_SHA = 'abcdef1234567890';
    process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-sha';

    expect(buildBackendVersionManifest()).toMatchObject({
      service: 'backend',
      commitSha: 'abcdef1234567890',
      commitShortSha: 'abcdef1',
    });
  });

  it('沒有顯式 commit env 時使用 Railway commit sha', () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = '1234567890railway';

    expect(buildBackendVersionManifest()).toMatchObject({
      commitSha: '1234567890railway',
      commitShortSha: '1234567',
    });
  });

  it('缺少 commit env 時回傳 unknown，避免偽造 commit', () => {
    expect(buildBackendVersionManifest()).toMatchObject({
      commitSha: 'unknown',
      commitShortSha: 'unknown',
    });
  });
});
