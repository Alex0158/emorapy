import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../../../prisma/migrations/20260713203000_allow_context_capsule_discard_tombstone/migration.sql',
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

describe('context capsule discard tombstone migration', () => {
  it('replaces the deployed revoked-state constraint with revoked-or-discarded tombstone semantics', () => {
    expect(migrationSql).toContain(
      'DROP CONSTRAINT "context_capsules_revoked_state_check"',
    );
    expect(migrationSql).toContain(
      'ADD CONSTRAINT "context_capsules_revoked_state_check" CHECK',
    );
    expect(migrationSql).toContain('"status" IN (\'revoked\', \'discarded\')');
    expect(migrationSql).toContain('"revoked_at" IS NOT NULL');
    expect(migrationSql).toContain('"status" NOT IN (\'revoked\', \'discarded\')');
    expect(migrationSql).toContain('"revoked_at" IS NULL');
  });
});
