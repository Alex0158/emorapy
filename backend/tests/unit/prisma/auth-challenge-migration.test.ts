import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../prisma/migrations/20260713130000_add_secure_email_challenges/migration.sql'
);

describe('secure auth challenge migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('不建立 plaintext code 欄位，digest 必須是 64 位 hex', () => {
    expect(sql).toContain('"code_digest" VARCHAR(64) NOT NULL');
    expect(sql).toContain('"code_digest" ~ \'^[0-9a-f]{64}$\'');
    expect(sql).not.toMatch(/"code"\s+VARCHAR/);
  });

  it('只有 provider accepted challenge 可驗證，且 terminal 狀態互斥', () => {
    expect(sql).toContain('"auth_challenges_delivery_state_check"');
    expect(sql).toContain('"auth_challenges_verified_delivery_check"');
    expect(sql).toContain('"auth_challenges_terminal_exclusive_check"');
  });

  it('release fixture 有獨立 provenance/status 與 synthetic boundary，不冒充 provider acceptance', () => {
    expect(sql).toContain('"AuthChallengeSource"');
    expect(sql).toContain("'release_fixture_ready'");
    expect(sql).toContain('"auth_challenges_release_fixture_boundary_check"');
    expect(sql).toContain("\"source\" = 'release_fixture'");
    expect(sql).toContain("\"provider_accepted_at\" IS NULL");
    expect(sql).toContain("\"id\" LIKE 'release-fixture-%'");
    expect(sql).toContain("\"email\" ~ '^claim-smoke-");
  });

  it('每個 email/purpose 只容許一個 active challenge，proof digest 唯一', () => {
    expect(sql).toContain('"auth_challenges_one_active_email_type_key"');
    expect(sql).toContain('WHERE "consumed_at" IS NULL');
    expect(sql).toContain('"auth_challenges_registration_proof_digest_key"');
  });

  it('切換時刪除無法安全遷移的 legacy plaintext OTP', () => {
    expect(sql).toContain('DELETE FROM "email_verifications";');
  });
});
