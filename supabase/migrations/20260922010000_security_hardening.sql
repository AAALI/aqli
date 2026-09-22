-- Close what the Supabase security advisor found, and make drafts private.
--
-- 1. SECURITY DEFINER functions in `public` are reachable over PostgREST by
--    anyone the grant allows — and Postgres grants EXECUTE to PUBLIC by
--    default, so "anyone" included signed-out visitors. Two of them mattered:
--
--      * record_migration_gate — writes app.migration_gates, the interlock that
--        keeps 20260805040000_body_md_canonical from running before its
--        backfill. A signed-out request could record the gate and disarm it.
--        Only the backfill script calls it, with the service key.
--      * preflight_report — refused signed-in non-admins, but a signed-out
--        caller has a null auth.uid(), which skipped the check and returned
--        the installation's schema, RLS state and row counts.
--
--    Each function now keeps exactly the grants its callers need (see the
--    list below); everything else loses EXECUTE.
--
-- 2. search_doc_chunks had a mutable search_path. It is only called with the
--    service key (lib/ai/context.ts through `scoped`), so it also loses
--    EXECUTE for signed-in and signed-out roles.
--
-- 3. Drafts were readable by every member of the workspace, which is the one
--    thing the Drafts page promises does not happen ("Nobody can see these but
--    you", v3 §3.2). An unpublished doc is now visible only to its owner and
--    to people someone mentioned on it — how a draft is shared. Drafts with no
--    owner at all (legacy rows) stay visible to the workspace rather than
--    becoming invisible to everyone. The same rule covers the draft's
--    comments. The service role is unaffected: agents, the merge engine and
--    the publish route all run there.

-- ---------------------------------------------------------------------------
-- 1. Function grants
-- ---------------------------------------------------------------------------

-- Service key only.
revoke execute on function public.record_migration_gate(text, jsonb) from public, anon, authenticated;
grant  execute on function public.record_migration_gate(text, jsonb) to service_role;

revoke execute on function public.blocked_space_ids(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.blocked_space_ids(uuid, uuid) to service_role;

-- Signed-in only: each of these already refuses a null auth.uid() or asks a
-- question only a member should, so a signed-out caller never had a use.
revoke execute on function public.accept_invitation(text) from public, anon;
grant  execute on function public.accept_invitation(text) to authenticated, service_role;

revoke execute on function public.create_workspace_for_user(text, text) from public, anon;
grant  execute on function public.create_workspace_for_user(text, text) to authenticated, service_role;

revoke execute on function public.list_workspace_members(uuid) from public, anon;
grant  execute on function public.list_workspace_members(uuid) to authenticated, service_role;

revoke execute on function public.is_space_reviewer(uuid, uuid) from public, anon;
grant  execute on function public.is_space_reviewer(uuid, uuid) to authenticated, service_role;

revoke execute on function public.space_names_reviewers(uuid) from public, anon;
grant  execute on function public.space_names_reviewers(uuid) to authenticated, service_role;

revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant  execute on function public.remove_member(uuid, uuid) to authenticated, service_role;

revoke execute on function public.update_member_role(uuid, uuid, text) from public, anon;
grant  execute on function public.update_member_role(uuid, uuid, text) to authenticated, service_role;

-- invitation_details stays callable signed-out on purpose: the invite page
-- shows which workspace you are joining before you have an account, and the
-- token itself is the secret.

-- preflight_report: admins (the Health page) and the service key (pnpm
-- preflight). A null auth.uid() is now refused unless the caller is the
-- service role, instead of being waved through.
create or replace function public.preflight_report(p_expected_migrations text[] default '{}'::text[])
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not exists (
    select 1 from members m where m.user_id = auth.uid() and m.role = 'admin'
  ) then
    raise exception using
      errcode = '42501',
      message = 'preflight_report is available to workspace admins';
  end if;
  return app.preflight(coalesce(p_expected_migrations, '{}'::text[]));
end
$$;
revoke execute on function public.preflight_report(text[]) from public, anon;
grant  execute on function public.preflight_report(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. search_doc_chunks
-- ---------------------------------------------------------------------------

-- Guarded: search_doc_chunks predates this folder and exists only in
-- installations that created it by hand, so a fresh install skips this.
do $$
declare
  fn regprocedure;
begin
  select p.oid::regprocedure into fn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_doc_chunks'
  limit 1;
  if fn is null then return; end if;
  execute format('alter function %s set search_path = public, pg_temp', fn);
  execute format('revoke execute on function %s from public, anon, authenticated', fn);
  execute format('grant execute on function %s to service_role', fn);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Drafts are private
-- ---------------------------------------------------------------------------

-- Whether someone was brought into a draft: mentioned in a comment on it.
-- SECURITY DEFINER so the docs policy does not read doc_comments through
-- doc_comments' own policies, which read docs — the recursion would fail.
create or replace function app.draft_shared_with(p_doc_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from doc_comments c
    where c.doc_id = p_doc_id and p_user_id = any (c.mentions)
  );
$$;
revoke all on function app.draft_shared_with(uuid, uuid) from public;
grant execute on function app.draft_shared_with(uuid, uuid) to authenticated, service_role;

-- The same question asked of a doc id, for tables that hang off docs.
create or replace function app.can_see_draft(p_doc_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select d.status <> 'draft'
        or d.owner_id is null
        or d.owner_id = p_user_id
        or app.draft_shared_with(d.id, p_user_id)
    from docs d where d.id = p_doc_id
  ), true);
$$;
revoke all on function app.can_see_draft(uuid, uuid) from public;
grant execute on function app.can_see_draft(uuid, uuid) to authenticated, service_role;

-- Restrictive, so it narrows what the existing member / editor policies
-- grant rather than widening it. FOR ALL: someone who cannot see a draft
-- cannot update or delete it either.
drop policy if exists docs_draft_privacy on public.docs;
create policy docs_draft_privacy on public.docs
  as restrictive
  for all
  to authenticated
  using (
    status <> 'draft'
    or owner_id is null
    or owner_id = (select auth.uid())
    or app.draft_shared_with(id, (select auth.uid()))
  );

drop policy if exists doc_comments_draft_privacy on public.doc_comments;
create policy doc_comments_draft_privacy on public.doc_comments
  as restrictive
  for select
  to authenticated
  using ( (select app.can_see_draft(doc_id, (select auth.uid()))) );
