-- Align the migration chain with Judgment.emotional_analysis in schema.prisma.
ALTER TABLE "judgments" ADD COLUMN IF NOT EXISTS "emotional_analysis" JSONB;
