import { validateSmokeSafetyEnv } from '../../../scripts/web-p0-true-service-smoke';

describe('web-p0-true-service-smoke safety env', () => {
  const baseEnv = {
    RUN_WEB_P0_TRUE_SERVICE_SMOKE: 'true',
    DATABASE_URL: 'postgresql://cj:cj_dev_pass@127.0.0.1:55432/cj_dev',
    WEB_P0_SMOKE_REPORT_PATH:
      'docs/核心開發文件/90-證據與盤點/環境與發版驗證/Web-P0-True-Service-test.json',
  };

  it('allows local database target when mutating opt-in and report path are present', () => {
    expect(() => validateSmokeSafetyEnv(baseEnv)).not.toThrow();
  });

  it('requires explicit mutating opt-in', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        RUN_WEB_P0_TRUE_SERVICE_SMOKE: 'false',
      })
    ).toThrow('RUN_WEB_P0_TRUE_SERVICE_SMOKE=true is required');
  });

  it('requires an evidence artifact path before mutation', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        WEB_P0_SMOKE_REPORT_PATH: '',
      })
    ).toThrow('WEB_P0_SMOKE_REPORT_PATH is required');
  });

  it('rejects remote database targets without explicit override', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres',
      })
    ).toThrow('WEB_P0_SMOKE_ALLOW_REMOTE_DB=true is required');
  });

  it('allows remote database targets only with explicit override', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres',
        WEB_P0_SMOKE_ALLOW_REMOTE_DB: 'true',
      })
    ).not.toThrow();
  });
});
