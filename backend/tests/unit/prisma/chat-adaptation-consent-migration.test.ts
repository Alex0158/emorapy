import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../../../prisma/migrations/20260713190000_add_chat_adaptation_consent/migration.sql',
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

describe('chat adaptation consent migration', () => {
  it('keeps owner authorization and all-participant consent as separate durable fields', () => {
    expect(migrationSql).toContain('"private_context_policy_version" VARCHAR(50)');
    expect(migrationSql).toContain('"private_context_preference_updated_at" TIMESTAMP(3)');
    expect(migrationSql).toContain('"shared_adaptation_consent" "SharedAdaptationConsentDecision"');
    expect(migrationSql).toContain('"shared_adaptation_policy_version" VARCHAR(50)');
    expect(migrationSql).toContain('"shared_adaptation_decided_at" TIMESTAMP(3)');
  });

  it('defaults shared consent to unanswered and resets legacy owner authorization fail closed', () => {
    expect(migrationSql).toContain("DEFAULT 'not_set'");
    expect(migrationSql).toMatch(
      /UPDATE\s+"chat_participants"[\s\S]*?SET[\s\S]*?"private_context_use_mode"\s*=\s*'private_only'/i,
    );
    expect(migrationSql).toMatch(
      /WHERE\s+"private_context_use_mode"\s*=\s*'shared_process_controls'/i,
    );
    expect(migrationSql).toContain('explicit versioned re-consent is required');
    expect(migrationSql).not.toMatch(
      /SET[\s\S]*?"shared_adaptation_consent"\s*=\s*'accepted'/i,
    );
    expect(migrationSql).not.toMatch(
      /SET[\s\S]*?"private_context_policy_version"\s*=\s*['"][^'"]+['"]/i,
    );
    expect(migrationSql.indexOf('UPDATE "chat_participants"')).toBeLessThan(
      migrationSql.indexOf(
        'ADD CONSTRAINT "chat_participants_private_context_authorization_check"',
      ),
    );
  });

  it('adds fail-closed consistency constraints for both consent layers', () => {
    expect(migrationSql).toContain('chat_participants_private_context_authorization_check');
    expect(migrationSql).toContain('chat_participants_shared_adaptation_consent_check');
    expect(migrationSql).toContain('"shared_adaptation_consent" IN (\'accepted\', \'declined\')');
  });
});
