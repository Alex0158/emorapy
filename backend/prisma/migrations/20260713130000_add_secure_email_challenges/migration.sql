-- Add a delivery-aware auth challenge store. New code never reads legacy plaintext OTP rows.
DO $$ BEGIN
  CREATE TYPE "AuthChallengeDeliveryStatus" AS ENUM ('pending', 'provider_accepted', 'failed', 'release_fixture_ready');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuthChallengeSource" AS ENUM ('provider', 'release_fixture');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "auth_challenges" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "type" "VerificationType" NOT NULL,
  "code_digest" VARCHAR(64) NOT NULL,
  "source" "AuthChallengeSource" NOT NULL DEFAULT 'provider',
  "delivery_status" "AuthChallengeDeliveryStatus" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "provider_accepted_at" TIMESTAMP(3),
  "delivery_failed_at" TIMESTAMP(3),
  "provider_message_id_digest" VARCHAR(64),
  "verified_at" TIMESTAMP(3),
  "consumed_at" TIMESTAMP(3),
  "invalidated_at" TIMESTAMP(3),
  "registration_proof_digest" VARCHAR(64),
  "registration_proof_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_challenges_email_normalized_check"
    CHECK ("email" = LOWER(BTRIM("email")) AND LENGTH("email") > 0),
  CONSTRAINT "auth_challenges_code_digest_check"
    CHECK ("code_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "auth_challenges_attempt_count_check"
    CHECK ("attempt_count" BETWEEN 0 AND 5),
  CONSTRAINT "auth_challenges_expiry_check"
    CHECK ("expires_at" > "created_at"),
  CONSTRAINT "auth_challenges_delivery_state_check"
    CHECK (
      (
        "source" = 'provider'
        AND (
          ("delivery_status" = 'pending' AND "provider_accepted_at" IS NULL AND "delivery_failed_at" IS NULL)
          OR
          ("delivery_status" = 'provider_accepted' AND "provider_accepted_at" IS NOT NULL AND "delivery_failed_at" IS NULL)
          OR
          ("delivery_status" = 'failed' AND "provider_accepted_at" IS NULL AND "delivery_failed_at" IS NOT NULL)
        )
      )
      OR (
        "source" = 'release_fixture'
        AND "delivery_status" = 'release_fixture_ready'
        AND "provider_accepted_at" IS NULL
        AND "delivery_failed_at" IS NULL
        AND "provider_message_id_digest" IS NULL
      )
    ),
  CONSTRAINT "auth_challenges_verified_delivery_check"
    CHECK (
      "verified_at" IS NULL
      OR (
        "source" = 'provider'
        AND "delivery_status" = 'provider_accepted'
        AND "verified_at" >= "provider_accepted_at"
      )
      OR (
        "source" = 'release_fixture'
        AND "delivery_status" = 'release_fixture_ready'
      )
    ),
  CONSTRAINT "auth_challenges_release_fixture_boundary_check"
    CHECK (
      (
        "source" = 'provider'
        AND "delivery_status" <> 'release_fixture_ready'
        AND "id" NOT LIKE 'release-fixture-%'
      )
      OR (
        "source" = 'release_fixture'
        AND "delivery_status" = 'release_fixture_ready'
        AND "id" LIKE 'release-fixture-%'
        AND "email" ~ '^claim-smoke-[a-z0-9_-]+@example[.]com$'
        AND "type" = 'register'
        AND "attempt_count" = 0
        AND "verified_at" IS NOT NULL
        AND "registration_proof_digest" ~ '^[0-9a-f]{64}$'
        AND "registration_proof_expires_at" > "verified_at"
      )
    ),
  CONSTRAINT "auth_challenges_terminal_exclusive_check"
    CHECK (NOT ("consumed_at" IS NOT NULL AND "invalidated_at" IS NOT NULL)),
  CONSTRAINT "auth_challenges_registration_proof_check"
    CHECK (
      (
        "type" = 'register'
        AND (
          ("verified_at" IS NULL AND "registration_proof_digest" IS NULL AND "registration_proof_expires_at" IS NULL)
          OR
          ("verified_at" IS NOT NULL AND "registration_proof_digest" ~ '^[0-9a-f]{64}$' AND "registration_proof_expires_at" > "verified_at")
        )
      )
      OR
      ("type" <> 'register' AND "registration_proof_digest" IS NULL AND "registration_proof_expires_at" IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_challenges_registration_proof_digest_key"
  ON "auth_challenges"("registration_proof_digest");
CREATE UNIQUE INDEX IF NOT EXISTS "auth_challenges_one_active_email_type_key"
  ON "auth_challenges"("email", "type")
  WHERE "consumed_at" IS NULL
    AND "invalidated_at" IS NULL
    AND "delivery_status" IN ('pending', 'provider_accepted', 'release_fixture_ready');
CREATE INDEX IF NOT EXISTS "auth_challenges_email_type_created_at_idx"
  ON "auth_challenges"("email", "type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_challenges_expires_at_idx"
  ON "auth_challenges"("expires_at");
CREATE INDEX IF NOT EXISTS "auth_challenges_registration_proof_expires_at_idx"
  ON "auth_challenges"("registration_proof_expires_at");

-- Existing OTP rows are ephemeral and cannot be migrated without preserving plaintext secrets.
DELETE FROM "email_verifications";
