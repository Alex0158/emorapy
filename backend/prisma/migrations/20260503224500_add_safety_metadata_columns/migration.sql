-- Add first-class safety metadata storage for case/evidence assertion gates.
-- Backfill the short-lived transitional JSON stored in evidences.description when present.

ALTER TABLE "cases"
  ADD COLUMN IF NOT EXISTS "safety_metadata" JSONB;

ALTER TABLE "evidences"
  ADD COLUMN IF NOT EXISTS "safety_metadata" JSONB;

DO $$
DECLARE
  evidence_record RECORD;
BEGIN
  FOR evidence_record IN
    SELECT "id", "description"
    FROM "evidences"
    WHERE "safety_metadata" IS NULL
      AND "description" IS NOT NULL
      AND "description" LIKE '{"safety_assertion"%'
  LOOP
    BEGIN
      UPDATE "evidences"
      SET "safety_metadata" = (evidence_record."description"::JSONB -> 'safety_assertion')
      WHERE "id" = evidence_record."id"
        AND "safety_metadata" IS NULL;
    EXCEPTION WHEN others THEN
      -- Ignore non-JSON descriptions that only resemble the transitional payload.
      NULL;
    END;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS "cases_safety_metadata_idx" ON "cases" USING GIN ("safety_metadata");
CREATE INDEX IF NOT EXISTS "evidences_safety_metadata_idx" ON "evidences" USING GIN ("safety_metadata");
