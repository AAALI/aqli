-- Member management: change a member's role, remove a member.
--
-- The members table deliberately has no UPDATE/DELETE policies (memberships
-- are created by SECURITY DEFINER RPCs), so management goes through RPCs that
-- enforce the rules in one place:
--   * caller must be an admin of the workspace
--   * the last admin can be neither demoted nor removed
-- Both functions run as SECURITY DEFINER with a pinned search_path and are
-- executable by authenticated users only.

create or replace function public.update_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_target_role text;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('admin', 'editor', 'viewer') then
    raise exception 'invalid role';
  end if;
  if not exists (
    select 1 from public.members
    where workspace_id = p_workspace_id and user_id = v_caller and role = 'admin'
  ) then
    raise exception 'admins only';
  end if;

  select role into v_target_role
  from public.members
  where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then
    raise exception 'not a member of this workspace';
  end if;

  if v_target_role = 'admin' and p_role <> 'admin' and (
    select count(*) from public.members
    where workspace_id = p_workspace_id and role = 'admin'
  ) <= 1 then
    raise exception 'cannot demote the last admin';
  end if;

  update public.members
  set role = p_role
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

create or replace function public.remove_member(
  p_workspace_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_target_role text;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.members
    where workspace_id = p_workspace_id and user_id = v_caller and role = 'admin'
  ) then
    raise exception 'admins only';
  end if;

  select role into v_target_role
  from public.members
  where workspace_id = p_workspace_id and user_id = p_user_id;
  if not found then
    raise exception 'not a member of this workspace';
  end if;

  if v_target_role = 'admin' and (
    select count(*) from public.members
    where workspace_id = p_workspace_id and role = 'admin'
  ) <= 1 then
    raise exception 'cannot remove the last admin';
  end if;

  delete from public.members
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.update_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.update_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
