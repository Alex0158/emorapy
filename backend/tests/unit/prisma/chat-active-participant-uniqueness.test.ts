import fs from 'node:fs';
import path from 'node:path';
import { RELEASE_BLOCKING_MIGRATIONS } from '../../../scripts/check-release-db-parity';

const authorizationMigrationName = '20260713090000_add_context_authorization_active_unique';
const chatContextFoundationMigrationSql = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../prisma/migrations/20260712210000_add_chat_context_domain_foundation/migration.sql'
  ),
  'utf8'
);
const authorizationMigrationSql = fs.readFileSync(
  path.resolve(__dirname, `../../../prisma/migrations/${authorizationMigrationName}/migration.sql`),
  'utf8'
);
const roleBMigrationSql = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../prisma/migrations/20260226230000_chat_active_roleb_unique/migration.sql'
  ),
  'utf8'
);
const otherRolesMigrationSql = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../prisma/migrations/20260227081000_chat_active_roles_unique/migration.sql'
  ),
  'utf8'
);

describe('durable active identity uniqueness', () => {
  it.each([
    ['roleA', 'ux_chat_participants_room_active_rolea', otherRolesMigrationSql],
    ['roleB', 'ux_chat_participants_room_active_roleb', roleBMigrationSql],
    ['aiMediator', 'ux_chat_participants_room_active_ai_mediator', otherRolesMigrationSql],
  ])('existing migration enforces one active %s per room', (role, index, sql) => {
    expect(sql).toContain(`CREATE UNIQUE INDEX "${index}"`);
    expect(sql).toContain(`WHERE "role_in_room" = '${role}' AND "is_active" = true`);
  });

  it('makes an unrevoked exact context grant durable and idempotent', () => {
    expect(authorizationMigrationSql).toContain(
      'CREATE UNIQUE INDEX "ux_context_authorizations_active_grant_identity"'
    );
    for (const column of [
      '"capsule_id"',
      '"subject_participant_id"',
      '"purpose"',
      '"audience"',
      '"target_type"',
      '"target_id"',
    ]) {
      expect(authorizationMigrationSql).toContain(column);
    }
    expect(authorizationMigrationSql).toContain('WHERE "revoked_at" IS NULL');
    expect(authorizationMigrationSql).toContain('duplicate exact grant group(s)');
    expect(authorizationMigrationSql).toContain('HAVING COUNT(*) > 1');
    expect(authorizationMigrationSql).toContain('RAISE EXCEPTION USING');
    expect(authorizationMigrationSql).not.toMatch(/^\s*(?:UPDATE|DELETE\s+FROM|TRUNCATE)\b/im);
  });

  it('allows only one active analysis consent request per room', () => {
    expect(chatContextFoundationMigrationSql).toContain(
      'CREATE UNIQUE INDEX "ux_chat_analysis_requests_room_active"'
    );
    expect(chatContextFoundationMigrationSql).toContain(
      `WHERE "status" IN ('pending_approval', 'approved', 'submitted', 'processing')`
    );
  });

  it('verifies the indexes and blocks release until the hardening migration is applied', () => {
    expect(authorizationMigrationSql).toContain('index_metadata.indisunique = true');
    expect(authorizationMigrationSql).toContain('index_metadata.indisvalid = true');
    expect(authorizationMigrationSql).toContain('index_metadata.indisready = true');
    expect(authorizationMigrationSql).toContain("SET lock_timeout = '5s'");
    expect(authorizationMigrationSql).toContain("SET statement_timeout = '60s'");
    expect(RELEASE_BLOCKING_MIGRATIONS).toContain(authorizationMigrationName);
  });
});
