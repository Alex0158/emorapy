-- A discarded capsule is a revoked tombstone: it remains addressable for
-- audit/idempotency while all dependent authorizations are revoked.

ALTER TABLE "context_capsules"
  DROP CONSTRAINT "context_capsules_revoked_state_check";

ALTER TABLE "context_capsules"
  ADD CONSTRAINT "context_capsules_revoked_state_check" CHECK (
    (
      "status" IN ('revoked', 'discarded')
      AND "revoked_at" IS NOT NULL
    )
    OR (
      "status" NOT IN ('revoked', 'discarded')
      AND "revoked_at" IS NULL
    )
  );
