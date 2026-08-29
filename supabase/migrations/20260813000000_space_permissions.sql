-- Private spaces (ADOPTION.md F-4).
--
-- Every company has content People, Finance or Legal will not put in a room the
-- whole company can read, and those teams usually have the most documentation
-- debt. Without this, adoption stalls at "the engineering and marketing wiki" —
-- which is where the evaluation started.
--
-- Two things make this different from the tenancy boundary already here:
--
--   * It is opt-in. A space is `open` unless someone makes it private, so
--     nothing changes for a workspace that never uses it.
--   * It has to hold on the *agent* path too, and that path runs as the service
--     role, which RLS does not apply to. The functions below are therefore
--     written to be callable both ways: as a policy predicate against
--     `auth.uid()`, and with an explicit user id for the code that has no
--     session — see `app.readable_space_ids`.
--
-- The policies added here are RESTRICTIVE. The permissive policies on `docs`
-- and its children predate this repository's migrations folder and are not
-- reproduced in it; a restrictive policy ANDs with whatever those are, so this
-- can tighten access without knowing exactly what already grants it. A
-- permissive policy added here would have done the opposite — widened it.

begin;

-- ---------------------------------------------------------------------------
-- Spaces gain a visibility
-- ---------------------------------------------------------------------------
alter table spaces
  add column if not exists visibility text not null default 'open'
    check (visibility in ('open', 'private'));

comment on column spaces.visibility is
  'open: every workspace member reads it. private: only its space_members do — in the UI, in search, in RAG, and on the agent path.';

-- ---------------------------------------------------------------------------
-- Who is in a space
-- ---------------------------------------------------------------------------
create table if not exists space_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  space_id     uuid not null references spaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- `reviewer` is a member who may also approve proposals in this space,
  -- which is what completes `review_all`: it says who approves, which the
  -- policy alone never did.
  role         text not null default 'member' check (role in ('member', 'reviewer')),
  created_at   timestamptz not null default now(),
  unique (space_id, user_id)
);

comment on table space_members is
  'Membership of a private space, and who may approve proposals in any space.';

create index if not exists space_members_user_idx on space_members (user_id, space_id);
create index if not exists space_members_space_idx on space_members (space_id, role);

-- ---------------------------------------------------------------------------
-- The predicate
-- ---------------------------------------------------------------------------
--
-- Takes the user explicitly rather than reading `auth.uid()`, so the same
-- function answers for a signed-in reader and for the owner of an API key. The
-- policies below pass `auth.uid()` in; the agent path passes the key's owner.
create or replace function app.can_read_space(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    -- A document with no space is workspace-wide by definition.
    p_space_id is null
    or exists (select 1 from spaces s where s.id = p_space_id and s.visibility = 'open')
    or exists (
      select 1 from space_members m
      where m.space_id = p_space_id and m.user_id = p_user_id
    );
$$;

/** The spaces a user may not read: private, and they are not a member. */
create or replace function app.blocked_space_ids(p_workspace_id uuid, p_user_id uuid)
returns setof uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select s.id
  from spaces s
  where s.workspace_id = p_workspace_id
    and s.visibility = 'private'
    and not exists (
      select 1 from space_members m
      where m.space_id = s.id and m.user_id = p_user_id
    );
$$;

comment on function app.blocked_space_ids(uuid, uuid) is
  'What the service-role paths filter on. RLS does not apply to the service role, so the agent API, RAG, the review queue and the activity feed ask this instead.';

/** The space a document is in — one lookup, so child tables can reuse it. */
create or replace function app.can_read_doc(p_doc_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select app.can_read_space((select space_id from docs where id = p_doc_id), p_user_id);
$$;

/** May this user approve proposals in this space? */
create or replace function app.is_space_reviewer(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from space_members m
    where m.space_id = p_space_id and m.user_id = p_user_id and m.role = 'reviewer'
  );
$$;

/**
 * Does this space name its own reviewers?
 *
 * A space with none behaves as it always has — any member with the standing to
 * merge may approve. Naming one is what narrows it, so turning the feature on
 * is a deliberate act rather than something that silently locks a team out of
 * its own review queue.
 */
create or replace function app.space_has_reviewers(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from space_members m where m.space_id = p_space_id and m.role = 'reviewer');
$$;

revoke all on function app.can_read_space(uuid, uuid) from public;
revoke all on function app.blocked_space_ids(uuid, uuid) from public;
revoke all on function app.can_read_doc(uuid, uuid) from public;
revoke all on function app.is_space_reviewer(uuid, uuid) from public;
revoke all on function app.space_has_reviewers(uuid) from public;
grant execute on function app.can_read_space(uuid, uuid) to authenticated, service_role;
grant execute on function app.blocked_space_ids(uuid, uuid) to authenticated, service_role;
grant execute on function app.can_read_doc(uuid, uuid) to authenticated, service_role;
grant execute on function app.is_space_reviewer(uuid, uuid) to authenticated, service_role;
grant execute on function app.space_has_reviewers(uuid) to authenticated, service_role;

-- PostgREST cannot reach `app`, so the review route gets shims for the two
-- reviewer questions, and the service-role code gets one for the blocked list
-- it needs on every agent request.
create or replace function public.blocked_space_ids(p_workspace_id uuid, p_user_id uuid)
returns setof uuid
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.blocked_space_ids(p_workspace_id, p_user_id);
$$;

revoke all on function public.blocked_space_ids(uuid, uuid) from public;
grant execute on function public.blocked_space_ids(uuid, uuid) to service_role;

create or replace function public.is_space_reviewer(p_space_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, app, pg_temp
as $$
  select app.is_space_reviewer(p_space_id, p_user_id);
$$;

create or replace function public.space_names_reviewers(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, app, pg_temp
as $$
  select app.space_has_reviewers(p_space_id);
$$;

revoke all on function public.is_space_reviewer(uuid, uuid) from public;
revoke all on function public.space_names_reviewers(uuid) from public;
grant execute on function public.is_space_reviewer(uuid, uuid) to authenticated, service_role;
grant execute on function public.space_names_reviewers(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- space_members: who can see and change it
-- ---------------------------------------------------------------------------
alter table space_members enable row level security;

-- Members of the workspace see who is in a space. Membership is not itself
-- secret — a private space's *existence* is visible, its contents are not —
-- and hiding the roster would make "ask someone who has access" impossible.
drop policy if exists space_members_read on space_members;
create policy space_members_read on space_members
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

drop policy if exists space_members_write on space_members;
create policy space_members_write on space_members
  for all to authenticated
  using ( (select app.member_role(workspace_id)) = 'admin' )
  with check ( (select app.member_role(workspace_id)) = 'admin' );

-- ---------------------------------------------------------------------------
-- The boundary, on every table that carries a document's content
-- ---------------------------------------------------------------------------
--
-- Restrictive, so each of these ANDs with the existing permissive policy rather
-- than replacing it. A table whose RLS is switched off entirely is not helped
-- by any of this — which is one of the things `pnpm preflight` reports.

-- Applied through a loop so a table this installation does not have — or has
-- not created yet — is skipped rather than failing the migration. `doc_chunks`
-- in particular is created by the embedding setup, not by this folder.
do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('docs',           'docs_space_visibility',           'app.can_read_space(space_id, (select auth.uid()))'),
      ('doc_comments',   'doc_comments_space_visibility',   'app.can_read_doc(doc_id, (select auth.uid()))'),
      ('doc_activity',   'doc_activity_space_visibility',   'app.can_read_doc(doc_id, (select auth.uid()))'),
      ('revisions',      'revisions_space_visibility',      'app.can_read_doc(document_id, (select auth.uid()))'),
      ('proposals',      'proposals_space_visibility',      'app.can_read_space(space_id, (select auth.uid()))'),
      -- Both ends: a backlink row names two documents, and a link *into* a
      -- public page from a private one would otherwise announce that the
      -- private page exists.
      ('document_links', 'document_links_space_visibility',
       'app.can_read_doc(from_document_id, (select auth.uid())) and app.can_read_doc(to_document_id, (select auth.uid()))'),
      ('doc_chunks',     'doc_chunks_space_visibility',     'app.can_read_doc(doc_id, (select auth.uid()))')
    ) as t(table_name, policy_name, predicate)
  loop
    if to_regclass('public.' || target.table_name) is null then
      raise notice 'skipping %: not present in this database', target.table_name;
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', target.policy_name, target.table_name);
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated using ( %s )',
      target.policy_name, target.table_name, target.predicate
    );
  end loop;
end $$;

commit;
