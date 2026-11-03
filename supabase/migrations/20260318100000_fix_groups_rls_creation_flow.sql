-- Fix groups creation flow under RLS.
-- 1) Ensure created_by is auto-populated from the authenticated user.
-- 2) Auto-add the group creator to group_members as admin.
-- 3) Update policies so creator/admin can manage membership safely.

ALTER TABLE public.groups
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Backfill creator membership for existing groups.
INSERT INTO public.group_members (group_id, user_id, role)
SELECT g.id, g.created_by, 'admin'
FROM public.groups g
WHERE NOT EXISTS (
  SELECT 1
  FROM public.group_members gm
  WHERE gm.group_id = g.id
    AND gm.user_id = g.created_by
);

CREATE OR REPLACE FUNCTION public.add_group_creator_as_admin_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_created_add_creator_member ON public.groups;

CREATE TRIGGER on_group_created_add_creator_member
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.add_group_creator_as_admin_member();

DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
CREATE POLICY "Members can view their groups"
ON public.groups
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_group_member(auth.uid(), id)
);

DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
CREATE POLICY "Group admins can add members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = group_id
      AND g.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
  )
);
