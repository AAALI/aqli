-- New workspaces start with a single "Company" space instead of the old
-- engineering-leaning trio (Product / Engineering / Compliance). Teams pick
-- the rest during onboarding.
CREATE OR REPLACE FUNCTION public.create_workspace_for_user(p_name text, p_slug text)
RETURNS workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_ws workspaces;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO workspaces (name, slug)
  VALUES (p_name, p_slug)
  RETURNING * INTO v_ws;

  INSERT INTO members (workspace_id, user_id, role)
  VALUES (v_ws.id, v_user, 'admin');

  INSERT INTO spaces (workspace_id, name, slug, icon)
  VALUES (v_ws.id, 'Company', 'company', '🏢');

  RETURN v_ws;
END;
$function$;
