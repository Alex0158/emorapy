-- Separate owner authorization for private-derived process controls from the
-- room-wide choice to accept anonymous dynamic mediation adjustments.

CREATE TYPE "SharedAdaptationConsentDecision" AS ENUM (
  'not_set',
  'accepted',
  'declined'
);

ALTER TYPE "ContextPurpose" ADD VALUE IF NOT EXISTS 'shared_mediation_adaptation';

ALTER TABLE "chat_participants"
  ADD COLUMN "private_context_policy_version" VARCHAR(50),
  ADD COLUMN "private_context_preference_updated_at" TIMESTAMP(3),
  ADD COLUMN "shared_adaptation_consent" "SharedAdaptationConsentDecision" NOT NULL DEFAULT 'not_set',
  ADD COLUMN "shared_adaptation_policy_version" VARCHAR(50),
  ADD COLUMN "shared_adaptation_decided_at" TIMESTAMP(3);

-- Legacy shared_process_controls rows predate the versioned authorization
-- contract. Reset them to the private-only baseline instead of inventing a
-- policy acceptance timestamp during migration.
DO $$
DECLARE
  reset_count INTEGER;
BEGIN
  UPDATE "chat_participants"
  SET
    "private_context_use_mode" = 'private_only',
    "private_context_policy_version" = NULL,
    "private_context_preference_updated_at" = NULL
  WHERE "private_context_use_mode" = 'shared_process_controls';

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RAISE NOTICE 'Reset % legacy shared_process_controls participants to private_only; explicit versioned re-consent is required', reset_count;
END $$;

ALTER TABLE "chat_participants"
  ADD CONSTRAINT "chat_participants_private_context_authorization_check" CHECK (
    "private_context_use_mode" = 'private_only'
    OR (
      "private_context_policy_version" IS NOT NULL
      AND length(btrim("private_context_policy_version")) > 0
      AND "private_context_preference_updated_at" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "chat_participants_shared_adaptation_consent_check" CHECK (
    (
      "shared_adaptation_consent" = 'not_set'
      AND "shared_adaptation_policy_version" IS NULL
      AND "shared_adaptation_decided_at" IS NULL
    )
    OR (
      "shared_adaptation_consent" IN ('accepted', 'declined')
      AND "shared_adaptation_policy_version" IS NOT NULL
      AND length(btrim("shared_adaptation_policy_version")) > 0
      AND "shared_adaptation_decided_at" IS NOT NULL
    )
  );

CREATE INDEX "chat_participants_room_id_shared_adaptation_consent_idx"
ON "chat_participants"("room_id", "shared_adaptation_consent");
