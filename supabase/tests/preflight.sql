-- `app.preflight` and its `public.preflight_report` shim (20260810000000).
--
-- The report is the thing an operator trusts when deciding whether an instance
-- is safe to invite people onto, so what matters is that it notices problems
-- rather than that it renders nicely: a table with RLS off must appear, a
-- missing migration must appear, and a non-admin must not be able to read any
-- of it.

begin;

set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- 1. The shape is there, and this database looks like the code expects
-- ---------------------------------------------------------------------------
do $$
declare r jsonb;
begin
  r := public.preflight_report();

  assert r ? 'migrations' and r ? 'rls' and r ? 'gates'
     and r ? 'markdown' and r ? 'retrieval' and r ? 'storage',
    format('report is missing a section: %s', r);

  -- The migration chain the runner just replayed ends with the canonical flip.
  assert (r -> 'markdown' ->> 'body_md_required')::boolean,
    'body_md should be NOT NULL after the migration chain';
  assert (r -> 'markdown' ->> 'at_risk_docs')::bigint = 0,
    'no document should have JSON content and empty markdown';
  assert r -> 'gates' ? 'body_md_backfill',
    'the backfill gate should be recorded';

  -- The doc-images bucket is created by 20260806010000 and must stay private.
  assert (r -> 'storage' ->> 'exists')::boolean, 'the doc-images bucket should exist';
  assert not (r -> 'storage' ->> 'public')::boolean, 'the doc-images bucket must not be public';
end $$;

-- ---------------------------------------------------------------------------
-- 2. A table with RLS off is reported
-- ---------------------------------------------------------------------------
--
-- This is the failure the report exists for: `doc_comments` shipped without
-- RLS, and under PostgREST that meant every workspace's comments were readable
-- by any authenticated user, with nothing in the UI to say so.
do $$
declare r jsonb;
begin
  create table public.pgtest_wide_open (id int primary key);

  r := public.preflight_report();
  assert (r -> 'rls' -> 'disabled') @> '["pgtest_wide_open"]'::jsonb,
    format('a table with RLS disabled must be reported, got %s', r -> 'rls');

  -- Enabling RLS without writing a policy is the other half: safe, but it
  -- usually means a migration landed halfway.
  alter table public.pgtest_wide_open enable row level security;
  r := public.preflight_report();
  assert not ((r -> 'rls' -> 'disabled') @> '["pgtest_wide_open"]'::jsonb),
    'a table with RLS enabled should leave the disabled list';
  assert (r -> 'rls' -> 'enabled_without_policies') @> '["pgtest_wide_open"]'::jsonb,
    format('a table with no policies must be reported, got %s', r -> 'rls');

  drop table public.pgtest_wide_open;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Migrations: missing and unknown, when the CLI ledger exists
-- ---------------------------------------------------------------------------
--
-- A hand-migrated database has no ledger, which the report says rather than
-- guessing at. When there is one, the comparison is against the versions the
-- checked-in repository expects.
do $$
declare r jsonb;
begin
  r := public.preflight_report(array['20260805000000']);
  assert not (r -> 'migrations' ->> 'tracked')::boolean,
    'without supabase_migrations.schema_migrations the report should say it cannot tell';

  create schema if not exists supabase_migrations;
  create table supabase_migrations.schema_migrations (version text primary key);
  insert into supabase_migrations.schema_migrations (version)
  values ('20260805000000'), ('29990101000000');

  r := public.preflight_report(array['20260805000000', '20260810000000']);
  assert (r -> 'migrations' ->> 'tracked')::boolean, 'the ledger should now be found';
  assert (r -> 'migrations' -> 'missing') @> '["20260810000000"]'::jsonb,
    format('an unapplied migration must be reported, got %s', r -> 'migrations');
  assert (r -> 'migrations' -> 'unknown') @> '["29990101000000"]'::jsonb,
    format('a migration applied but absent from the repo must be reported, got %s', r -> 'migrations');

  drop schema supabase_migrations cascade;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Only admins may read it
-- ---------------------------------------------------------------------------
--
-- The report names tables, gates and row counts. That is reconnaissance for
-- anyone who is not running the instance, so an editor is refused outright
-- rather than served a redacted version.
do $$
declare
  admin_id  uuid := gen_random_uuid();
  editor_id uuid := gen_random_uuid();
  ws        uuid;
  caught    boolean := false;
  r         jsonb;
begin
  insert into auth.users (id, email) values (admin_id, 'admin@example.test'), (editor_id, 'editor@example.test');
  insert into workspaces (name, slug) values ('Preflight', 'preflight-test') returning id into ws;
  insert into members (workspace_id, user_id, role) values (ws, admin_id, 'admin'), (ws, editor_id, 'editor');

  perform set_config('test.uid', editor_id::text, true);
  begin
    r := public.preflight_report();
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'an editor must not be able to read the preflight report';

  perform set_config('test.uid', admin_id::text, true);
  r := public.preflight_report();
  assert r ? 'rls', 'an admin should get the report';

  perform set_config('test.uid', '', true);
end $$;

rollback;
