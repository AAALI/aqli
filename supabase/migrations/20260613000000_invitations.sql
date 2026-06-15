-- Workspace invitations: admins mint invite tokens, invitees redeem them.
-- Link-based (no email dependency): the token in the URL is the secret.

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('admin','editor','viewer')),
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

create index if not exists invitations_workspace_idx on public.invitations (workspace_id);
create index if not exists invitations_token_idx on public.invitations (token);

alter table public.invitations enable row level security;

-- Workspace admins can fully manage invitations for their workspace.
drop policy if exists "admins manage invitations" on public.invitations;
create policy "admins manage invitations" on public.invitations
  for all
  using (
    exists (
      select 1 from public.members m
      where m.workspace_id = invitations.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.workspace_id = invitations.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

-- Public, token-gated lookup so an invitee (possibly signed out) can see what
-- they were invited to before creating an account. Returns nothing for a bad
-- token. SECURITY DEFINER to read across workspaces without exposing the table.
create or replace function public.invitation_details(p_token text)
returns table (
  workspace_name text,
  workspace_slug text,
  role text,
  email text,
  status text,
  expired boolean
)
language sql
security definer
set search_path = public
as $$
  select w.name, w.slug, i.role, i.email, i.status, (i.expires_at < now())
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token;
$$;

-- Redeem an invitation for the signed-in user. Adds membership and marks the
-- invite accepted. The token is the authorization; any signed-in user holding
-- a valid token may join.
create or replace function public.accept_invitation(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations;
  v_user uuid := auth.uid();
  v_slug text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.invitations where token = p_token;
  if not found then
    raise exception 'invalid invitation';
  end if;
  if inv.status <> 'pending' then
    raise exception 'invitation already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'invitation expired';
  end if;

  insert into public.members (workspace_id, user_id, role)
  values (inv.workspace_id, v_user, inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.invitations
    set status = 'accepted', accepted_at = now(), accepted_by = v_user
    where id = inv.id;

  select slug into v_slug from public.workspaces where id = inv.workspace_id;
  return v_slug;
end;
$$;

-- List members of a workspace with their auth email. Caller must be a member.
create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  email text,
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
    select m.user_id, u.email::text, m.role, m.created_at
    from public.members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id
    order by m.created_at asc;
end;
$$;

revoke execute on function public.invitation_details(text) from public;
grant execute on function public.invitation_details(text) to anon, authenticated;
revoke execute on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;
revoke execute on function public.list_workspace_members(uuid) from public;
grant execute on function public.list_workspace_members(uuid) to authenticated;
