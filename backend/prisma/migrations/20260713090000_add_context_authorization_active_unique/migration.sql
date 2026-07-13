-- Make exact active grants idempotent across processes without rewriting legacy data.
-- PostgreSQL cannot use now() in an index predicate, so the durable active state is
-- "unrevoked"; the service revokes expired exact grants before issuing a replacement.
DO $$
DECLARE
  duplicate_group_count bigint;
BEGIN
  SELECT COUNT(*)::bigint
  INTO duplicate_group_count
  FROM (
    SELECT
      "capsule_id",
      "subject_participant_id",
      "purpose",
      "audience",
      "target_type",
      "target_id"
    FROM "context_authorizations"
    WHERE "revoked_at" IS NULL
    GROUP BY
      "capsule_id",
      "subject_participant_id",
      "purpose",
      "audience",
      "target_type",
      "target_id"
    HAVING COUNT(*) > 1
  ) duplicate_authorizations;

  IF duplicate_group_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format(
        'active context authorization uniqueness preflight failed: %s duplicate exact grant group(s)',
        duplicate_group_count
      ),
      HINT = 'Inspect duplicate grants and resolve them through an approved data-repair runbook; this migration never updates or deletes authorization rows.';
  END IF;
END $$;

-- Bound deployment impact: a busy drifted database fails closed instead of waiting
-- indefinitely for a write lock. The table is introduced by the immediately preceding
-- expand migration, so the normal release path builds this index while it is still small.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE UNIQUE INDEX "ux_context_authorizations_active_grant_identity"
ON "context_authorizations"(
  "capsule_id",
  "subject_participant_id",
  "purpose",
  "audience",
  "target_type",
  "target_id"
)
WHERE "revoked_at" IS NULL;

RESET statement_timeout;
RESET lock_timeout;

-- Fail closed if the index is not valid, unique, or attached to the exact identity.
DO $$
DECLARE
  actual_definition text;
BEGIN
  SELECT pg_get_indexdef(index_relation.oid)
  INTO actual_definition
  FROM pg_class index_relation
  JOIN pg_namespace index_namespace ON index_namespace.oid = index_relation.relnamespace
  JOIN pg_index index_metadata ON index_metadata.indexrelid = index_relation.oid
  JOIN pg_class table_relation ON table_relation.oid = index_metadata.indrelid
  WHERE index_namespace.nspname = current_schema()
    AND index_relation.relname = 'ux_context_authorizations_active_grant_identity'
    AND table_relation.relname = 'context_authorizations'
    AND index_metadata.indisunique = true
    AND index_metadata.indisvalid = true
    AND index_metadata.indisready = true
    AND index_metadata.indnkeyatts = 6
    AND pg_get_indexdef(index_metadata.indexrelid, 1, true) = 'capsule_id'
    AND pg_get_indexdef(index_metadata.indexrelid, 2, true) = 'subject_participant_id'
    AND pg_get_indexdef(index_metadata.indexrelid, 3, true) = 'purpose'
    AND pg_get_indexdef(index_metadata.indexrelid, 4, true) = 'audience'
    AND pg_get_indexdef(index_metadata.indexrelid, 5, true) = 'target_type'
    AND pg_get_indexdef(index_metadata.indexrelid, 6, true) = 'target_id';

  IF actual_definition IS NULL
    OR position('revoked_at' IN actual_definition) = 0
    OR position('IS NULL' IN actual_definition) = 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'active context authorization unique index is missing or invalid',
      HINT = 'Do not bypass this migration. Inspect pg_index/pg_indexes and repair the index through an approved database runbook.';
  END IF;
END $$;
