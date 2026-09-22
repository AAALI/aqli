-- Draft privacy and function grants (20260922010000).
--
-- A draft is visible to its owner and to people mentioned on it; nobody else
-- in the workspace. Signed-out callers cannot record migration gates or read
-- the preflight report.
--
--   ./supabase/tests/run.sh

begin;

set client_min_messages = warning;

create temp table t (k text primary key, v uuid);
grant select on t to authenticated;

do $$
declare ws uuid; alice uuid; bob uuid; carol uuid; sp uuid; draft uuid; shared uuid; pub uuid;
begin
  insert into auth.users (email) values ('alice@test') returning id into alice;
  insert into auth.users (email) values ('bob@test')   returning id into bob;
  insert into auth.users (email) values ('carol@test') returning id into carol;
  insert into workspaces (name, slug) values ('A', 'ws-a') returning id into ws;
  insert into members (workspace_id, user_id, role) values
    (ws, alice, 'admin'), (ws, bob, 'editor'), (ws, carol, 'editor');
  insert into spaces (workspace_id, name, slug) values (ws, 'Company', 'company') returning id into sp;
  insert into docs (workspace_id, space_id, title, body_md, status, owner_id)
    values (ws, sp, 'Alice private', 'x', 'draft', alice) returning id into draft;
  insert into docs (workspace_id, space_id, title, body_md, status, owner_id)
    values (ws, sp, 'Alice shared with Bob', 'x', 'draft', alice) returning id into shared;
  insert into docs (workspace_id, space_id, title, body_md, status, owner_id)
    values (ws, sp, 'Published', 'x', 'approved', alice) returning id into pub;
  insert into doc_comments (doc_id, workspace_id, author_id, body, comment_type, mentions)
    values (shared, ws, alice, 'Bob, add the numbers?', 'comment', array[bob]);
  insert into t values ('alice', alice), ('bob', bob), ('carol', carol),
    ('draft', draft), ('shared', shared), ('pub', pub);
end $$;

set local role authenticated;

do $$
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  assert (select count(*) from docs) = 3, 'the owner sees her drafts and the published doc';

  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  assert (select count(*) from docs where id = (select v from t where k = 'shared')) = 1,
    'a member mentioned on a draft can see it';
  assert (select count(*) from docs where id = (select v from t where k = 'draft')) = 0,
    'a member cannot see someone else''s private draft';

  perform set_config('test.uid', (select v from t where k = 'carol')::text, true);
  assert (select count(*) from docs) = 1, 'a member sees only what is published';
  assert (select count(*) from doc_comments) = 0,
    'comments on a draft are as private as the draft';

  -- Cannot edit what you cannot see.
  update docs set title = 'hijacked' where id = (select v from t where k = 'draft');
  assert (select count(*) from docs where title = 'hijacked') = 0, 'a hidden draft was updated';
end $$;

reset role;

do $$
begin
  assert not has_function_privilege('anon', 'public.record_migration_gate(text,jsonb)', 'execute'),
    'signed-out callers can record a migration gate';
  assert not has_function_privilege('authenticated', 'public.record_migration_gate(text,jsonb)', 'execute'),
    'signed-in callers can record a migration gate';
  assert not has_function_privilege('anon', 'public.preflight_report(text[])', 'execute'),
    'signed-out callers can read the preflight report';
  assert has_function_privilege('anon', 'public.invitation_details(text)', 'execute'),
    'the invite page needs invitation_details before sign-in';
end $$;

rollback;
