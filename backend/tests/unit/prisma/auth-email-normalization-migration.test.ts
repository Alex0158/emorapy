import fs from 'node:fs';
import path from 'node:path';

const migrationName = '20260713153000_normalize_user_emails';
const migrationPath = path.resolve(
  __dirname,
  `../../../prisma/migrations/${migrationName}/migration.sql`
);

describe('normalized user email migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('fails before backfill when canonical addresses collide or are blank', () => {
    expect(sql).toContain('USER_EMAIL_NORMALIZATION_BLANK_ROWS');
    expect(sql).toContain('USER_EMAIL_NORMALIZATION_COLLISIONS');
    expect(sql.indexOf('RAISE EXCEPTION')).toBeLessThan(sql.indexOf('UPDATE "users"'));
    expect(sql).toContain('HAVING COUNT(*) > 1');
  });

  it('canonicalizes existing rows and keeps case-insensitive rollback compatibility', () => {
    expect(sql).toContain('SET "email" = LOWER(BTRIM("email"))');
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "citext"');
    expect(sql).toContain('ALTER COLUMN "email" TYPE CITEXT');
    expect(sql).not.toContain('users_email_normalized_check');
    expect(sql.trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
  });
});
