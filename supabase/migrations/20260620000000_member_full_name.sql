-- Surface each member's display name (from auth metadata) alongside their email
-- so doc lists can attribute human-authored docs by name instead of a generic
-- "Member" chip. Return signature changes, so drop-then-recreate.
drop function if exists public.list_workspace_members(uuid);

create function public.list_workspace_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
  ) then
    raise exception 'not a member';
  end if;

  return query
    select
      m.user_id,
      u.email::text,
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')::text,
      m.role,
      m.created_at
    from public.members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id
    order by m.created_at asc;
end;
$$;

revoke execute on function public.list_workspace_members(uuid) from public;
grant execute on function public.list_workspace_members(uuid) to authenticated;
