-- Corrective migration for duplicate key errors on group_members(group_id, user_id).
-- Safe to run after existing migrations.
--
-- Why this is needed:
-- - Group creator is auto-added via groups trigger.
-- - Some app flows may also try to insert the same membership.
-- - Under concurrency, a simple EXISTS check can still race.
--
-- This migration makes inserts idempotent with a transaction-scoped advisory lock.

CREATE OR REPLACE FUNCTION public.skip_duplicate_group_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership_lock_key BIGINT;
BEGIN
  -- Serialize inserts for the same (group_id, user_id) pair in this transaction.
  membership_lock_key := hashtextextended(NEW.group_id::text || ':' || NEW.user_id::text, 0);
  PERFORM pg_advisory_xact_lock(membership_lock_key);

  IF EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.user_id = NEW.user_id
  ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_insert_skip_duplicate_group_member ON public.group_members;

CREATE TRIGGER before_insert_skip_duplicate_group_member
BEFORE INSERT ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.skip_duplicate_group_member_insert();
