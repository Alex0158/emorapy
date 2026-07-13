BEGIN;

-- Auth lookups canonicalize email addresses. Abort before changing data when
-- historical rows would collapse to the same canonical address.
DO $$
DECLARE
  blank_count INTEGER;
  collision_group_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO blank_count
  FROM "users"
  WHERE BTRIM("email") = '';

  SELECT COUNT(*)::INTEGER
  INTO collision_group_count
  FROM (
    SELECT LOWER(BTRIM("email")) AS normalized_email
    FROM "users"
    GROUP BY LOWER(BTRIM("email"))
    HAVING COUNT(*) > 1
  ) AS collisions;

  IF blank_count > 0 THEN
    RAISE EXCEPTION 'USER_EMAIL_NORMALIZATION_BLANK_ROWS:%', blank_count;
  END IF;
  IF collision_group_count > 0 THEN
    RAISE EXCEPTION 'USER_EMAIL_NORMALIZATION_COLLISIONS:%', collision_group_count;
  END IF;
END $$;

UPDATE "users"
SET "email" = LOWER(BTRIM("email"))
WHERE "email" <> LOWER(BTRIM("email"));

-- CITEXT makes both the new canonicalized runtime and the previous rollback
-- runtime resolve case variants consistently. The existing unique constraint
-- is rebuilt with CITEXT semantics and therefore blocks semantic duplicates.
CREATE EXTENSION IF NOT EXISTS "citext";
ALTER TABLE "users"
  ALTER COLUMN "email" TYPE CITEXT
  USING "email"::CITEXT;

COMMIT;
