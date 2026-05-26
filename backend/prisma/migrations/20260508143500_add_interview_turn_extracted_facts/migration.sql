-- AlterTable
ALTER TABLE "interview_turns"
ADD COLUMN IF NOT EXISTS "extracted_facts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
