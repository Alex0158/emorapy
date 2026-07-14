import {
  buildSmokeAccountHygieneReport,
  classifySmokeAccount,
  collectSmokeAccountCandidates,
  type SmokeAccountCandidate,
} from '../../../src/utils/smoke-account-hygiene';

describe('smoke-account-hygiene', () => {
  const baseCandidate: SmokeAccountCandidate = {
    kind: 'user',
    id: 'u1',
    email: 'real@example.com',
    is_active: true,
    created_at: new Date('2026-05-03T00:00:00.000Z'),
  };

  it('應標記 active claim smoke user', () => {
    expect(
      classifySmokeAccount({
        ...baseCandidate,
        email: 'CLAIM-SMOKE-123@example.com',
      })
    ).toEqual(
      expect.objectContaining({
        email: 'claim-smoke-123@example.com',
        ruleId: 'claim-smoke-generated-user',
      })
    );
  });

  it('應標記 active Web P0 true-service smoke user', () => {
    expect(
      classifySmokeAccount({
        ...baseCandidate,
        email: 'WEB-P0-A-20260713@example.com',
      })
    ).toEqual(
      expect.objectContaining({
        email: 'web-p0-a-20260713@example.com',
        ruleId: 'web-p0-generated-user',
      })
    );
  });

  it('應標記預設開發用戶與管理員帳號', () => {
    expect(classifySmokeAccount({ ...baseCandidate, email: 'boyfriend@test.com' })).toEqual(
      expect.objectContaining({ ruleId: 'default-dev-user' })
    );
    expect(
      classifySmokeAccount({
        kind: 'admin_user',
        id: 'a1',
        email: 'admin-smoke@example.com',
        is_active: true,
      })
    ).toEqual(expect.objectContaining({ ruleId: 'default-smoke-admin' }));
    expect(
      classifySmokeAccount({
        kind: 'admin_user',
        id: 'a2',
        email: 'admin1@gmail.com',
        is_active: true,
      })
    ).toEqual(expect.objectContaining({ ruleId: 'default-dev-admin' }));
  });

  it('inactive 或非白名單帳號不應被標記', () => {
    expect(classifySmokeAccount({ ...baseCandidate, email: 'claim-smoke-123@example.com', is_active: false })).toBeNull();
    expect(classifySmokeAccount({ ...baseCandidate, email: 'customer@example.com' })).toBeNull();
    expect(classifySmokeAccount({ ...baseCandidate, email: 'claim-smoke-123@customer.com' })).toBeNull();
  });

  it('應生成 fail-fast 報告並穩定排序', () => {
    const report = buildSmokeAccountHygieneReport(
      [
        { kind: 'user', id: 'u2', email: 'g1@gmail.com', is_active: true },
        { kind: 'admin_user', id: 'a1', email: 'admin-smoke@example.com', is_active: true },
        { kind: 'user', id: 'u1', email: 'customer@example.com', is_active: true },
      ],
      '2026-05-03T00:00:00.000Z'
    );

    expect(report).toEqual({
      ok: false,
      check: 'smoke-account-hygiene',
      generatedAt: '2026-05-03T00:00:00.000Z',
      activeFindingCount: 2,
      findings: [
        expect.objectContaining({ kind: 'admin_user', email: 'admin-smoke@example.com' }),
        expect.objectContaining({ kind: 'user', email: 'g1@gmail.com' }),
      ],
    });
  });

  it('共享 candidate collector 查詢 claim 與 web-p0 generated users', async () => {
    const userFindMany = jest.fn().mockResolvedValue([]);
    const adminFindMany = jest.fn().mockResolvedValue([]);

    await collectSmokeAccountCandidates({
      user: { findMany: userFindMany },
      adminUser: { findMany: adminFindMany },
    } as never);

    const userWhere = userFindMany.mock.calls[0]?.[0]?.where;
    expect(userWhere.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: expect.objectContaining({ startsWith: 'claim-smoke-' }),
        }),
        expect.objectContaining({
          email: expect.objectContaining({ startsWith: 'web-p0-' }),
        }),
      ])
    );
  });
});
