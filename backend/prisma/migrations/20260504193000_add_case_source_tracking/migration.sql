-- Additive case source tracking for product-flow reporting and backfill.
-- Runtime classifiers remain the compatibility source while release DB parity is rolled out.

ALTER TABLE "cases"
  ADD COLUMN "product_flow" VARCHAR(50),
  ADD COLUMN "source_channel" VARCHAR(50),
  ADD COLUMN "entry_point" VARCHAR(50);

UPDATE "cases" c
SET
  "product_flow" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "chat_to_case_links" l WHERE l."case_id" = c."id"
    ) THEN 'chat_to_case'
    WHEN c."mode" = 'quick' THEN 'quick_single'
    WHEN c."mode" = 'collaborative' AND c."session_id" IS NOT NULL THEN 'quick_collaborative'
    WHEN c."mode" = 'collaborative' AND c."session_id" IS NULL THEN 'formal_collaborative'
    ELSE 'formal_remote'
  END,
  "source_channel" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "chat_to_case_links" l WHERE l."case_id" = c."id"
    ) THEN 'chat_room'
    WHEN c."mode" = 'quick' THEN 'quick_experience'
    WHEN c."mode" = 'collaborative' AND c."session_id" IS NOT NULL THEN 'quick_experience'
    ELSE 'formal_case'
  END,
  "entry_point" = CASE
    WHEN EXISTS (
      SELECT 1 FROM "chat_to_case_links" l WHERE l."case_id" = c."id"
    ) THEN 'chat_request_judgment'
    WHEN c."mode" = 'quick' THEN 'quick_single_case_create'
    WHEN c."mode" = 'collaborative' AND c."session_id" IS NOT NULL THEN 'quick_collaborative_case_create'
    WHEN c."mode" = 'collaborative' AND c."session_id" IS NULL THEN 'formal_collaborative_case_create'
    ELSE 'formal_remote_case_create'
  END
WHERE c."product_flow" IS NULL
  OR c."source_channel" IS NULL
  OR c."entry_point" IS NULL;

CREATE INDEX "idx_cases_product_flow_created" ON "cases"("product_flow", "created_at");
CREATE INDEX "idx_cases_source_channel_created" ON "cases"("source_channel", "created_at");
CREATE INDEX "idx_cases_entry_point_created" ON "cases"("entry_point", "created_at");
