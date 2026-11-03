-- Make duplicate group membership inserts idempotent.
-- This prevents runtime failures when the same (group_id, user_id)
-- pair is inserted more than once in a transaction flow.

CREATE OR REPLACE FUNCTION public.skip_duplicate_group_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
