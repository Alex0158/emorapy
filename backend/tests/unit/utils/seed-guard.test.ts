import { assertSeedAllowed, isLikelyProductionDatabase } from '../../../src/utils/seed-guard';

describe('seed-guard', () => {
  it('允許本機 development seed', () => {
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/cj_dev',
      })
    ).not.toThrow();
  });

  it('production NODE_ENV 預設拒絕 seed', () => {
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/cj_dev',
      })
    ).toThrow(/Refusing to run prisma seed/);
  });

  it('疑似 production 遠端 DB 預設拒絕 seed', () => {
    expect(isLikelyProductionDatabase('postgresql://postgres:secret@db.abc.supabase.co:5432/postgres')).toBe(true);
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:secret@db.abc.supabase.co:5432/postgres',
      })
    ).toThrow(/Refusing to run prisma seed/);
  });

  it('允許已知 Supabase Dev project seed', () => {
    expect(isLikelyProductionDatabase('postgresql://postgres:secret@db.lbukyqztkkkztfrfltlh.supabase.co:5432/postgres')).toBe(false);
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:secret@db.lbukyqztkkkztfrfltlh.supabase.co:5432/postgres',
      })
    ).not.toThrow();
  });

  it('明確 override 時允許高風險 seed', () => {
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:secret@db.abc.supabase.co:5432/postgres',
        ALLOW_PRODUCTION_SEED: 'true',
      })
    ).not.toThrow();
  });
});
