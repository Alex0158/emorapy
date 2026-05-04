-- Enforce that a user can only appear in one normal pending/active pairing.
-- Partial unique indexes on user1_id/user2_id cannot cover cross-role duplicates,
-- so this trigger checks both participant columns under per-user advisory locks.

CREATE OR REPLACE FUNCTION enforce_normal_pairing_unique_participants()
RETURNS trigger AS $$
DECLARE
  participant_ids text[];
  participant_id text;
  conflicting_pairing_id text;
BEGIN
  IF NEW.pairing_type = 'normal' AND NEW.status IN ('pending', 'active') THEN
    IF NEW.user1_id IS NULL AND NEW.user2_id IS NULL THEN
      RAISE EXCEPTION 'normal pending/active pairing requires at least one participant'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.user1_id IS NOT NULL AND NEW.user2_id IS NOT NULL AND NEW.user1_id = NEW.user2_id THEN
      RAISE EXCEPTION 'normal pairing participants must be different users'
        USING ERRCODE = '23514';
    END IF;

    SELECT array_agg(user_id ORDER BY user_id)
      INTO participant_ids
    FROM (
      SELECT NEW.user1_id AS user_id WHERE NEW.user1_id IS NOT NULL
      UNION
      SELECT NEW.user2_id AS user_id WHERE NEW.user2_id IS NOT NULL
    ) participants;

    FOREACH participant_id IN ARRAY participant_ids LOOP
      PERFORM pg_advisory_xact_lock(20260504, hashtext(participant_id));
    END LOOP;

    SELECT p.id
      INTO conflicting_pairing_id
    FROM pairings p
    WHERE p.id IS DISTINCT FROM NEW.id
      AND p.pairing_type = 'normal'
      AND p.status IN ('pending', 'active')
      AND (
        p.user1_id = ANY(participant_ids)
        OR p.user2_id = ANY(participant_ids)
      )
    LIMIT 1;

    IF conflicting_pairing_id IS NOT NULL THEN
      RAISE EXCEPTION 'normal pending/active pairing participant already exists in pairing %', conflicting_pairing_id
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_normal_pairing_unique_participants ON pairings;

CREATE TRIGGER trg_enforce_normal_pairing_unique_participants
BEFORE INSERT OR UPDATE OF user1_id, user2_id, status, pairing_type
ON pairings
FOR EACH ROW
EXECUTE FUNCTION enforce_normal_pairing_unique_participants();
