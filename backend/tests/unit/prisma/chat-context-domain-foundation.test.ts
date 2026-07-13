import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../../../prisma/migrations/20260712210000_add_chat_context_domain_foundation/migration.sql'
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

describe('chat context domain foundation migration', () => {
  it('is expand-only and leaves legacy messages unclassified', () => {
    expect(migrationSql).toContain('ADD COLUMN "channel_id" TEXT');
    expect(migrationSql).toContain(
      'ADD COLUMN "ai_context_eligible" BOOLEAN NOT NULL DEFAULT false'
    );
    expect(migrationSql).not.toMatch(
      /^\s*(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM|TRUNCATE|DROP)\b/im
    );
    expect(migrationSql).not.toContain('ALTER COLUMN "visibility_scope"');
  });

  it('enforces one shared channel and one private channel per participant', () => {
    expect(migrationSql).toContain('CONSTRAINT "chat_channels_owner_matches_kind_check"');
    expect(migrationSql).toContain('CREATE UNIQUE INDEX "ux_chat_channels_room_shared"');
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "ux_chat_channels_room_private_owner"'
    );
  });

  it('pins grants and participant approvals to exact hash and policy versions', () => {
    expect(migrationSql).toContain(
      'FOREIGN KEY ("capsule_id", "capsule_content_hash", "policy_version")'
    );
    expect(migrationSql).toContain(
      'REFERENCES "context_capsules"("id", "content_hash", "policy_version")'
    );
    expect(migrationSql).toContain(
      'FOREIGN KEY ("analysis_request_id", "selection_hash", "policy_version")'
    );
    expect(migrationSql).toContain(
      'REFERENCES "chat_analysis_requests"("id", "selection_hash", "policy_version")'
    );
    expect(migrationSql).toContain('ON DELETE CASCADE ON UPDATE RESTRICT');
  });

  it('stores only low-sensitivity lineage in the context-use audit table', () => {
    const auditTable = migrationSql.match(
      /CREATE TABLE "context_use_audits" \([\s\S]*?\n\);/
    )?.[0];

    expect(auditTable).toBeDefined();
    expect(auditTable).toContain('"source_refs" JSONB NOT NULL');
    expect(auditTable).toContain('"authorization_refs" JSONB NOT NULL');
    expect(auditTable).toContain('"content_hashes" TEXT[]');
    expect(auditTable).not.toMatch(/"(?:content|summary|raw_content|raw_narrative)"\s/);
  });
});
