-- Outbound notification endpoints (20260814000000).
--
-- A webhook URL is a capability: anyone holding it can post into the channel it
-- points at. So the interesting assertions are about who can read the row, not
-- only who can write it.

begin;

set client_min_messages = warning;

do $$
declare
  ws     uuid;
  other  uuid;
  admin_id  uuid := gen_random_uuid();
  editor_id uuid := gen_random_uuid();
  caught boolean := false;
begin
  insert into auth.users (id, email) values (admin_id, 'admin@example.test'), (editor_id, 'editor@example.test');
  insert into workspaces (name, slug) values ('Acme', 'acme-hooks') returning id into ws;
  insert into workspaces (name, slug) values ('Other', 'other-hooks') returning id into other;
  insert into members (workspace_id, user_id, role) values (ws, admin_id, 'admin'), (ws, editor_id, 'editor');

  -- https only, and enforced by the database rather than only by the route:
  -- this payload carries document titles across the internet.
  begin
    insert into workspace_webhooks (workspace_id, url) values (ws, 'http://hooks.example/plain');
  exception when check_violation then caught := true;
  end;
  assert caught, 'a plaintext http endpoint must be refused';

  insert into workspace_webhooks (workspace_id, url) values (ws, 'https://hooks.example/abc');

  assert (select events from workspace_webhooks where workspace_id = ws) = '{}',
    'an endpoint added without choosing events should receive all of them';
end $$;

-- ---------------------------------------------------------------------------
-- Only admins, and only their own workspace
-- ---------------------------------------------------------------------------
do $$
declare
  ws        uuid := (select id from workspaces where slug = 'acme-hooks');
  admin_id  uuid := (select user_id from members where workspace_id = ws and role = 'admin');
  editor_id uuid := (select user_id from members where workspace_id = ws and role = 'editor');
  visible   int;
begin
  execute 'grant select, insert, update, delete on workspace_webhooks to authenticated';

  perform set_config('test.uid', admin_id::text, true);
  set local role authenticated;
  select count(*) into visible from workspace_webhooks;
  reset role;
  assert visible = 1, format('an admin should see their workspace''s endpoints, saw %s', visible);

  -- An editor cannot read it: knowing the URL is being able to post to it.
  perform set_config('test.uid', editor_id::text, true);
  set local role authenticated;
  select count(*) into visible from workspace_webhooks;
  reset role;
  assert visible = 0, 'a non-admin must not be able to read a webhook URL';

  perform set_config('test.uid', '', true);
end $$;

rollback;
