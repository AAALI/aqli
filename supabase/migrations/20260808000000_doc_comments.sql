-- Comments and @mentions (roadmap phase 2, item 3).
--
-- `doc_comments` predates this migrations folder — it was created by hand in
-- the original database and is reconstructed in `supabase/tests/base.sql`. It
-- has been written to since day one (`rejectDoc` and `requestChanges` store the
-- reviewer's reason there) but never read back by any screen, and it never had
-- row level security. This migration turns it into a table the product can
-- actually expose:
--
--   * RLS, so a comment is visible to the workspace that owns the document and
--     to nobody else. Without this the table is reachable through PostgREST by
--     any authenticated user, because a table with RLS disabled applies no
--     restriction at all.
--   * `comment_type` gets a default and a check constraint, so the review trail
--     and ordinary comments are distinguishable rather than "text, sometimes
--     null".
--   * `mentions`, the user ids named in the body. Derived server-side from the
--     body when the comment is written — never taken from the client — so it
--     can be indexed and asked "which comments mention me" without scanning
--     every body.

-- --- shape -----------------------------------------------------------------

alter table public.doc_comments
  add column if not exists mentions uuid[] not null default '{}'::uuid[];

comment on column public.doc_comments.mentions is
  'User ids mentioned in body, extracted server-side by lib/mentions.ts and filtered to workspace members. Not client-supplied.';

-- Rows written before this migration carry a null type; they are all review
-- trail entries or plain comments, and 'comment' is the honest default for the
-- ones with nothing more specific recorded.
update public.doc_comments set comment_type = 'comment' where comment_type is null;

alter table public.doc_comments
  alter column comment_type set default 'comment';

alter table public.doc_comments
  alter column comment_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doc_comments_type_check'
  ) then
    alter table public.doc_comments
      add constraint doc_comments_type_check check (
        comment_type in ('comment', 'review_request', 'approval', 'rejection', 'change_request')
      );
  end if;
end $$;

-- A comment body is prose, not a document: no markdown pipeline runs over it,
-- so the only thing to enforce is that it is neither empty nor unbounded.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doc_comments_body_check'
  ) then
    alter table public.doc_comments
      add constraint doc_comments_body_check check (
        length(btrim(body)) between 1 and 10000
      );
  end if;
end $$;

-- --- indexes ---------------------------------------------------------------

-- The thread read: every comment on one doc, oldest first.
create index if not exists doc_comments_doc_idx
  on public.doc_comments (doc_id, created_at);

-- "Comments that mention me", for the notification feed.
create index if not exists doc_comments_mentions_idx
  on public.doc_comments using gin (mentions);

create index if not exists doc_comments_workspace_created_idx
  on public.doc_comments (workspace_id, created_at desc);

-- --- row level security ----------------------------------------------------
--
-- Same shape as the step-1 policies on `revisions` and `proposals`:
-- `app.is_member` is SECURITY DEFINER, so the policy does not depend on the
-- caller holding select on `members`, and the `(select ...)` wrapper lets the
-- planner evaluate it once per statement instead of once per row.

-- Whether a doc belongs to a workspace. SECURITY DEFINER for the same reason
-- as `app.is_member`: a policy that reads `docs` directly would also be read
-- through `docs`' own RLS and the caller's grants, which makes the comment
-- policy depend on the doc policy staying permissive. This asks the flat
-- question and nothing else.
create or replace function app.doc_in_workspace(doc uuid, ws uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from docs where id = doc and workspace_id = ws);
$$;

revoke all on function app.doc_in_workspace(uuid, uuid) from public;
grant execute on function app.doc_in_workspace(uuid, uuid) to authenticated, service_role;

alter table public.doc_comments enable row level security;

grant select, insert, delete on table public.doc_comments to authenticated;

-- Read: any member of the owning workspace. Comments are doc-level discussion,
-- and a doc is already visible to the whole workspace — space-level privacy is
-- a later roadmap item, and when it lands this policy follows the doc.
drop policy if exists doc_comments_read on public.doc_comments;
create policy doc_comments_read on public.doc_comments
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

-- Write: members who can edit, as themselves. A viewer reads the handbook; it
-- is the same role that cannot change a doc, so it does not get to annotate one
-- either. `author_id = auth.uid()` stops a member posting under someone else's
-- name, and the type is pinned to 'comment' because every other value is a
-- review-trail entry the server writes on the service client.
drop policy if exists doc_comments_insert on public.doc_comments;
create policy doc_comments_insert on public.doc_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and comment_type = 'comment'
    and (select app.member_role(workspace_id)) in ('admin', 'editor')
    and (select app.doc_in_workspace(doc_id, workspace_id))
  );

-- Delete: your own comment, or anything in your workspace if you are an admin.
-- The review trail is deliberately excluded from both — a rejection reason is
-- the record of a decision, not a remark, and the document's history is worth
-- less if the reason it bounced can be taken back.
drop policy if exists doc_comments_delete on public.doc_comments;
create policy doc_comments_delete on public.doc_comments
  for delete to authenticated
  using (
    comment_type = 'comment'
    and (
      author_id = (select auth.uid())
      or (select app.member_role(workspace_id)) = 'admin'
    )
  );

-- No update policy. Editing a comment is not in this release, and an absent
-- policy denies rather than allows.

comment on table public.doc_comments is
  'Doc-level discussion and the review trail. comment_type = comment is written by people through /api/docs/[id]/comments; every other value is written by the review path on the service client.';
