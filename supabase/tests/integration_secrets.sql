-- `integration_secrets` must be unreachable from any user session
-- (20260809000000).
--
-- This table holds GitHub personal access tokens with `repo` scope. It exists
-- as a separate table precisely because `integration_connections` is readable
-- by every member of the workspace — the settings page shows connection status
-- to everyone — and Postgres has no column-level RLS to hide a token inside a
-- row people are allowed to read.
--
-- The protection is RLS enabled with **no policies at all**, plus no grants.
-- That is easy to undo by accident: adding a policy "so the settings page can
-- check whether a token exists" would hand every viewer a repo-scoped token.
-- These assertions are here to make that show up as a failing test.
--
--   ./supabase/tests/run.sh

begin;

set client_min_messages = warning;

create temp table t (k text primary key, v uuid);
grant select on t to authenticated;

-- Supabase grants `authenticated` table privileges on `public` and lets RLS do
-- the filtering; a scratch cluster does not. `integration_connections`' read
-- policy checks membership with an inline `exists (select 1 from members ...)`
-- rather than a SECURITY DEFINER helper, so without these the policy itself
-- raises "permission denied for table members". Granted here, and rolled back
-- with the rest of the transaction.
grant select on public.members to authenticated;
grant select on public.integration_connections to authenticated;

do $$
declare
  ws uuid; admin_user uuid; viewer_user uuid; conn uuid;
begin
  insert into auth.users (email) values ('admin@test')  returning id into admin_user;
  insert into auth.users (email) values ('viewer@test') returning id into viewer_user;

  insert into workspaces (name, slug) values ('A', 'ws-a') returning id into ws;
  insert into members (workspace_id, user_id, role) values
    (ws, admin_user, 'admin'), (ws, viewer_user, 'viewer');

  insert into integration_connections (workspace_id, user_id, provider, status, composio_user_id)
  values (ws, admin_user, 'github', 'connected', 'aqli:' || ws || ':' || admin_user)
  returning id into conn;

  insert into integration_secrets (connection_id, workspace_id, access_token, webhook_secret)
  values (conn, ws, 'ghp_supersecret', 'deadbeef');

  insert into t values ('ws', ws), ('admin', admin_user), ('viewer', viewer_user), ('conn', conn);
end $$;

-- ---------------------------------------------------------------------------
-- 1. The shape the protection depends on
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.integration_secrets'::regclass),
    'RLS is not enabled on integration_secrets';

  assert (select count(*) from pg_policies
          where schemaname = 'public' and tablename = 'integration_secrets') = 0,
    'integration_secrets has a policy; with RLS on and no policies, no user session can read it — a policy is how that protection gets lost';

  -- Belt as well as braces: even if a policy appeared, no grant means no read.
  assert not has_table_privilege('authenticated', 'public.integration_secrets', 'SELECT'),
    'authenticated has SELECT on integration_secrets';
  assert not has_table_privilege('anon', 'public.integration_secrets', 'SELECT'),
    'anon has SELECT on integration_secrets';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Nobody with a session can read a token — not even the admin who set it
-- ---------------------------------------------------------------------------
set local role authenticated;

do $$
declare caught boolean;
begin
  for i in 1..2 loop
    perform set_config(
      'test.uid',
      (select v from t where k = case when i = 1 then 'admin' else 'viewer' end)::text,
      true
    );
    caught := false;
    begin
      perform 1 from integration_secrets;
    exception when insufficient_privilege then caught := true;
    end;
    assert caught, format('a session (%s) could reach integration_secrets', i);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. The connection row stays readable — that is the reason for two tables
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config('test.uid', (select v from t where k = 'viewer')::text, true);
  assert (select count(*) from integration_connections
          where workspace_id = (select v from t where k = 'ws')) = 1,
    'a member should still see that GitHub is connected';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 4. Secrets die with their connection
-- ---------------------------------------------------------------------------
do $$
begin
  -- Assert the row is there first, so the post-delete count proves a cascade
  -- rather than passing because the fixture never inserted anything.
  assert (select count(*) from integration_secrets
          where connection_id = (select v from t where k = 'conn')) = 1,
    'fixture did not create the secret row';
  assert (select access_token from integration_secrets
          where connection_id = (select v from t where k = 'conn')) = 'ghp_supersecret';

  delete from integration_connections where id = (select v from t where k = 'conn');
  assert (select count(*) from integration_secrets) = 0,
    'deleting a connection left its token behind';
end $$;

rollback;
