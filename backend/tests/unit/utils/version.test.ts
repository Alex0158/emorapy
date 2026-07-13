import { buildBackendVersionManifest } from '../../../src/utils/version';

describe('version utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EMORAPY_COMMIT_SHA;
    delete process.env.CJ_COMMIT_SHA;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GITHUB_SHA;
    delete process.env.SOURCE_VERSION;
    delete process.env.COMMIT_SHA;
    delete process.env.RAILWAY_DEPLOYMENT_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('優先使用 EMORAPY_COMMIT_SHA', () => {
    process.env.EMORAPY_COMMIT_SHA = 'emorapy1234567890';
    process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-distractor-sha';

    expect(buildBackendVersionManifest()).toMatchObject({
      service: 'backend',
      commitSha: 'emorapy1234567890',
      commitShortSha: 'emorapy',
    });
  });

  it('不再讀取已棄用的 CJ_COMMIT_SHA（P4 env deprecation）', () => {
    process.env.CJ_COMMIT_SHA = 'abcdef1234567890';

    expect(buildBackendVersionManifest()).toMatchObject({
      service: 'backend',
      commitSha: 'unknown',
      commitShortSha: 'unknown',
    });
  });

  it('Railway runtime 優先使用 Railway deployment commit sha', () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = '1234567890railway';
    process.env.EMORAPY_COMMIT_SHA = 'stale-emorapy-sha';

    expect(buildBackendVersionManifest()).toMatchObject({
      commitSha: '1234567890railway',
      commitShortSha: '1234567',
    });
  });

  it('Railway runtime 暴露 immutable deployment id 供 release 因果綁定', () => {
    process.env.RAILWAY_DEPLOYMENT_ID = 'deployment-123';

    expect(buildBackendVersionManifest()).toMatchObject({
      deploymentId: 'deployment-123',
    });
  });

  it('缺少 commit env 時回傳 unknown，避免偽造 commit', () => {
    expect(buildBackendVersionManifest()).toMatchObject({
      commitSha: 'unknown',
      commitShortSha: 'unknown',
      deploymentId: null,
    });
  });
});
