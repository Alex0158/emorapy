import {
  LEGACY_MESSAGE_BATCH_SQL,
  parseChatChannelBackfillArgs,
} from '../../../scripts/backfill-chat-context-channels';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('backfill-chat-context-channels CLI', () => {
  it('persists display-only versus reusable context decisions with the channel assignment', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../scripts/backfill-chat-context-channels.ts'),
      'utf8',
    );
    expect(source).toContain('ai_context_eligible: target.aiContextEligible');
    expect(source).toContain("decision.futureContextEligible");
  });

  it('uses only the unique active roleB join boundary, never historical MIN(joined_at)', () => {
    expect(LEGACY_MESSAGE_BATCH_SQL).toContain("AND is_active = true");
    expect(LEGACY_MESSAGE_BATCH_SQL).toContain('AND left_at IS NULL');
    expect(LEGACY_MESSAGE_BATCH_SQL).toContain('COUNT(*)::integer AS candidate_count');
    expect(LEGACY_MESSAGE_BATCH_SQL).not.toMatch(
      /role_in_room = 'roleB'\s*\n\) role_b/,
    );
  });

  it('defaults to dry-run with a bounded batch size', () => {
    expect(parseChatChannelBackfillArgs([])).toEqual({
      apply: false,
      dryRun: true,
      batchSize: 250,
      target: 'local',
      confirmProduction: false,
      help: false,
    });
  });

  it('requires the explicit --apply switch before write mode', () => {
    expect(parseChatChannelBackfillArgs(['--apply', '--batch-size=50'])).toMatchObject({
      apply: true,
      dryRun: false,
      batchSize: 50,
    });
  });

  it('requires an additional confirmation for release and production apply', () => {
    expect(() => parseChatChannelBackfillArgs([
      '--apply',
      '--target=production',
    ])).toThrow('requires --confirm-production');

    expect(parseChatChannelBackfillArgs([
      '--apply',
      '--target=production',
      '--confirm-production',
    ])).toMatchObject({
      apply: true,
      target: 'production',
      confirmProduction: true,
    });
  });

  it('rejects ambiguous or unbounded modes', () => {
    expect(() => parseChatChannelBackfillArgs(['--apply', '--dry-run'])).toThrow(
      'cannot be combined',
    );
    expect(() => parseChatChannelBackfillArgs(['--batch-size=0'])).toThrow(
      'between 1 and 1000',
    );
    expect(() => parseChatChannelBackfillArgs(['--batch-size=1001'])).toThrow(
      'between 1 and 1000',
    );
    expect(() => parseChatChannelBackfillArgs(['--target=unknown'])).toThrow(
      'Invalid --target',
    );
    expect(() => parseChatChannelBackfillArgs(['--confirm-production'])).toThrow(
      'valid only with --apply',
    );
  });

  it('supports help without changing the default dry-run mode', () => {
    expect(parseChatChannelBackfillArgs(['--help'])).toMatchObject({
      help: true,
      apply: false,
      dryRun: true,
    });
  });
});
