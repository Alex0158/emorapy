-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "login_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;
