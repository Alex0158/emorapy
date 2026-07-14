import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../../../prisma/migrations/20260713201500_add_chat_safety_router_state/migration.sql',
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

describe('chat safety router migration', () => {
  it('uses a closed action allowlist and one current state per room owner', () => {
    expect(migrationSql).toContain('CREATE TYPE "ChatSafetyRouterAction" AS ENUM');
    for (const action of [
      'continue',
      'private_checkin',
      'pause_shared',
      'block_joint_repair',
      'crisis_support',
    ]) {
      expect(migrationSql).toContain(`'${action}'`);
    }
    expect(migrationSql).toContain('"ux_chat_safety_router_room_owner"');
  });

  it('stores only action state and no private text, topic, diagnosis, or reason columns', () => {
    expect(migrationSql).toContain('"action" "ChatSafetyRouterAction"');
    expect(migrationSql).toContain('"policy_version" VARCHAR(50)');
    expect(migrationSql).toContain('"state_version" INTEGER');
    expect(migrationSql).not.toMatch(/"(content|raw_text|topic|diagnosis|reason)"/i);
  });

  it('keeps room cleanup cascading while preventing owner identity deletion', () => {
    expect(migrationSql).toMatch(
      /"room_id"[\s\S]*REFERENCES "chat_rooms"\("id"\)[\s\S]*ON DELETE CASCADE/,
    );
    expect(migrationSql).toMatch(
      /"owner_participant_id"[\s\S]*REFERENCES "chat_participants"\("id"\)[\s\S]*ON DELETE RESTRICT/,
    );
  });
});
