import { createHash } from 'node:crypto';
import {
  buildLegacyPrivacyAuditBlockingFindings,
  buildProfileSnapshotAuditReport,
  MESSAGE_AI_CONTEXT_ELIGIBILITY_GROUP_SQL,
  parseLegacyPrivacyAuditArgs,
} from '../../../scripts/audit-private-context-legacy-data';

describe('audit-private-context-legacy-data', () => {
  it('audits persisted AI-context eligibility without selecting message content', () => {
    expect(MESSAGE_AI_CONTEXT_ELIGIBILITY_GROUP_SQL).toContain('m.ai_context_eligible');
    expect(MESSAGE_AI_CONTEXT_ELIGIBILITY_GROUP_SQL).toContain('chat_channels');
    expect(MESSAGE_AI_CONTEXT_ELIGIBILITY_GROUP_SQL).not.toMatch(/m\.content\b/);
  });

  it('is permanently read-only and rejects apply', () => {
    expect(parseLegacyPrivacyAuditArgs([])).toEqual({
      target: 'local',
      topKeys: 100,
      statementTimeoutMs: 30_000,
      help: false,
      readOnly: true,
    });
    expect(() => parseLegacyPrivacyAuditArgs(['--apply'])).toThrow('permanently read-only');
  });

  it('validates target and bounded key-stat options', () => {
    expect(
      parseLegacyPrivacyAuditArgs([
        '--target=release',
        '--top-keys=25',
        '--statement-timeout-ms=15000',
      ])
    ).toMatchObject({
      target: 'release',
      topKeys: 25,
      statementTimeoutMs: 15_000,
      readOnly: true,
    });
    expect(() => parseLegacyPrivacyAuditArgs(['--top-keys=0'])).toThrow('between 1 and 500');
    expect(() => parseLegacyPrivacyAuditArgs(['--target=unknown'])).toThrow('Invalid --target');
    expect(() => parseLegacyPrivacyAuditArgs(['--statement-timeout-ms=999'])).toThrow(
      'between 1000 and 120000'
    );
  });

  it('reports ProfileSnapshot key/schema risk without returning raw keys or values', () => {
    const rawKey = 'raw_narrative';
    const harmlessKey = 'richness_score';
    const report = buildProfileSnapshotAuditReport(
      {
        snapshot_count: 3n,
        user_count: 2n,
        case_count: 3n,
        root_object_count: 3n,
        root_array_count: 0n,
        root_scalar_count: 0n,
      },
      [
        {
          key_name: rawKey,
          value_type: 'string',
          depth: 2,
          occurrences: 2n,
          snapshot_count: 2n,
        },
        {
          key_name: harmlessKey,
          value_type: 'number',
          depth: 1,
          occurrences: 3n,
          snapshot_count: 3n,
        },
      ],
      {
        raw_like_key_occurrences: 2n,
        snapshots_with_raw_like_keys: 2n,
        long_string_occurrences: 2n,
        snapshots_with_long_strings: 2n,
        very_long_string_occurrences: 1n,
        oversized_array_occurrences: 0n,
        max_depth_seen: 4,
        truncated_container_occurrences: 0n,
      }
    );

    expect(report).toMatchObject({
      snapshots: 3,
      users: 2,
      cases: 3,
      rootSchema: { object: 3, array: 0, scalar: 0 },
      rawLikeRisk: {
        keyOccurrences: 2,
        affectedSnapshotsByKey: 2,
        longStringOccurrences: 2,
        veryLongStringOccurrences: 1,
      },
    });
    expect(report.hashedKeySchema[0]).toEqual({
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      valueType: 'string',
      depth: 2,
      occurrences: 2,
      snapshots: 2,
      rawLikeRisk: true,
    });
    expect(report.hashedKeySchema[1]?.rawLikeRisk).toBe(false);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(rawKey);
    expect(serialized).not.toContain(harmlessKey);
  });

  it('fails closed for unclassified rows, incomplete traversal, and relationship drift', () => {
    expect(
      buildLegacyPrivacyAuditBlockingFindings({
        unclassifiedMessageRows: 3,
        unknownPrivateContextModeRows: 2,
        activeParticipantDuplicateGroups: 5,
        activeAuthorizationDuplicateGroups: 2,
        truncatedProfileSnapshotContainers: 1,
        orphans: {
          messageRoom: 0,
          messageSender: 0,
          channelOwner: 0,
          channelOwnerRoomMismatch: 4,
          capsuleOwner: 0,
          capsuleSourceChannel: 0,
          capsuleRoomMismatch: 0,
        },
      })
    ).toEqual([
      { code: 'unclassified_chat_messages', rows: 3 },
      { code: 'unknown_private_context_mode', rows: 2 },
      { code: 'active_participant_uniqueness_drift', rows: 5 },
      { code: 'active_context_authorization_uniqueness_drift', rows: 2 },
      { code: 'profile_snapshot_audit_truncated', rows: 1 },
      { code: 'referential_integrity_drift', rows: 4 },
    ]);
  });

  it('passes only when all release-blocking invariants are clean', () => {
    expect(
      buildLegacyPrivacyAuditBlockingFindings({
        unclassifiedMessageRows: 0,
        unknownPrivateContextModeRows: 0,
        activeParticipantDuplicateGroups: 0,
        activeAuthorizationDuplicateGroups: 0,
        truncatedProfileSnapshotContainers: 0,
        orphans: {
          messageRoom: 0,
          messageSender: 0,
          channelOwner: 0,
          channelOwnerRoomMismatch: 0,
          capsuleOwner: 0,
          capsuleSourceChannel: 0,
          capsuleRoomMismatch: 0,
        },
      })
    ).toEqual([]);
  });
});
