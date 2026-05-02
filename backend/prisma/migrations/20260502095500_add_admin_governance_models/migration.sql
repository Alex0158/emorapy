-- Add admin governance models that are present in Prisma schema but were missing
-- from the migration chain used by production-like CI smoke tests.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminRoleKey') THEN
    CREATE TYPE "AdminRoleKey" AS ENUM ('super_admin', 'ops', 'marketing', 'support');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CronRunStatus') THEN
    CREATE TYPE "CronRunStatus" AS ENUM ('running', 'success', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "admin_roles" (
  "id" TEXT NOT NULL,
  "key" "AdminRoleKey" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" JSONB NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "system_configs" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "description" TEXT,
  "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
  "is_runtime" BOOLEAN NOT NULL DEFAULT true,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cron_run_logs" (
  "id" TEXT NOT NULL,
  "job_name" VARCHAR(100) NOT NULL,
  "status" "CronRunStatus" NOT NULL DEFAULT 'running',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  "affected_count" INTEGER,
  "detail" JSONB,
  "triggered_by_admin_id" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cron_run_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_roles_key_key" ON "admin_roles"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_key" ON "admin_users"("email");
CREATE INDEX IF NOT EXISTS "admin_users_role_id_idx" ON "admin_users"("role_id");
CREATE INDEX IF NOT EXISTS "admin_users_is_active_idx" ON "admin_users"("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "system_configs_key_key" ON "system_configs"("key");
CREATE INDEX IF NOT EXISTS "system_configs_is_runtime_idx" ON "system_configs"("is_runtime");
CREATE INDEX IF NOT EXISTS "cron_run_logs_job_name_started_at_idx" ON "cron_run_logs"("job_name", "started_at");
CREATE INDEX IF NOT EXISTS "cron_run_logs_status_started_at_idx" ON "cron_run_logs"("status", "started_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_role_id_fkey') THEN
    ALTER TABLE "admin_users"
      ADD CONSTRAINT "admin_users_role_id_fkey"
      FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cron_run_logs_triggered_by_admin_id_fkey') THEN
    ALTER TABLE "cron_run_logs"
      ADD CONSTRAINT "cron_run_logs_triggered_by_admin_id_fkey"
      FOREIGN KEY ("triggered_by_admin_id") REFERENCES "admin_users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
