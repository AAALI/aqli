-- Rollback for 20260808000000_doc_comments.sql
--
-- Returns `doc_comments` to the shape it had before: no RLS, a nullable
-- untyped `comment_type`, no mentions column.
--
-- It drops `mentions`, and with it the record of who was named in each
-- comment. The names are still in the bodies (`@[Name](user:<uuid>)`), so
-- re-applying the migration and re-extracting is possible — but the column is
-- not reconstructed by the rollback itself.
--
-- Disabling RLS is what makes this a rollback worth thinking twice about: the
-- table becomes readable through PostgREST by any authenticated user again.
-- Only run it if the application code that reads comments is also going away.

begin;

drop policy if exists "members read doc comments" on public.doc_comments;
drop policy if exists "editors write doc comments" on public.doc_comments;
drop policy if exists "authors delete own doc comments" on public.doc_comments;

alter table public.doc_comments disable row level security;

revoke select, insert, delete on table public.doc_comments from authenticated;

drop index if exists public.doc_comments_doc_idx;
drop index if exists public.doc_comments_mentions_idx;
drop index if exists public.doc_comments_workspace_created_idx;

alter table public.doc_comments drop constraint if exists doc_comments_type_check;
alter table public.doc_comments drop constraint if exists doc_comments_body_check;

alter table public.doc_comments alter column comment_type drop not null;
alter table public.doc_comments alter column comment_type drop default;

alter table public.doc_comments drop column if exists mentions;

drop function if exists app.doc_in_workspace(uuid, uuid);

commit;
