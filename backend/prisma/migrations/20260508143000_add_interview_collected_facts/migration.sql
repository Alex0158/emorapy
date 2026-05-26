-- AlterTable
ALTER TABLE "interview_sessions"
ADD COLUMN IF NOT EXISTS "collected_facts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
