-- RLS for `asked_questions` and `doc_reads` (20260921000000).
--
-- Gaps are shared work, so a workspace can see what it asked; nobody else can,
-- and nobody can record a question or a read as someone other than themselves.
--
--   ./supabase/tests/run.sh

begin;

set client_min_messages = warning;

create temp table t (k text primary key, v uuid);
grant select on t to authenticated;

do $$
declare
  ws_a uuid; ws_b uuid; alice uuid; bob uuid; carol uuid; space_a uuid; doc_a uuid;
begin
  insert into auth.users (email) values ('alice@test') returning id into alice;
  insert into auth.users (email) values ('bob@test')   returning id into bob;
  insert into auth.users (email) values ('carol@test') returning id into carol;
  insert into workspaces (name, slug) values ('A', 'ws-a') returning id into ws_a;
  insert into workspaces (name, slug) values ('B', 'ws-b') returning id into ws_b;
  insert into members (workspace_id, user_id, role) values
    (ws_a, alice, 'admin'), (ws_a, bob, 'editor'), (ws_b, carol, 'admin');
  insert into spaces (workspace_id, name, slug) values (ws_a, 'Company', 'company') returning id into space_a;
  insert into docs (workspace_id, space_id, title, body_md)
    values (ws_a, space_a, 'Refunds', 'how') returning id into doc_a;
  insert into t values ('ws_a', ws_a), ('ws_b', ws_b), ('alice', alice), ('bob', bob),
    ('carol', carol), ('doc_a', doc_a), ('space_a', space_a);
end $$;

set local role authenticated;

do $$
begin
  -- Bob asks a question in A, as himself.
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  insert into asked_questions (workspace_id, asked_by, question, normalized)
  values ((select v from t where k = 'ws_a'), (select v from t where k = 'bob'),
          'How do I refund a partial payout?', 'how do i refund a partial payout');

  -- …and Alice can see it: gaps are shared.
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  assert (select count(*) from asked_questions) = 1, 'a member should see the workspace''s questions';

  -- Carol, in B, cannot.
  perform set_config('test.uid', (select v from t where k = 'carol')::text, true);
  assert (select count(*) from asked_questions) = 0, 'workspace B can read A''s questions';
end $$;

do $$
begin
  -- Nobody records a question as someone else.
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  begin
    insert into asked_questions (workspace_id, asked_by, question, normalized)
    values ((select v from t where k = 'ws_a'), (select v from t where k = 'bob'), 'forged', 'forged');
    assert false, 'a question was recorded as another member';
  exception when insufficient_privilege then null;
  end;

  -- A read is recorded once per person per doc, as yourself.
  insert into doc_reads (workspace_id, doc_id)
  values ((select v from t where k = 'ws_a'), (select v from t where k = 'doc_a'));
  assert (select user_id from doc_reads) = (select v from t where k = 'alice');

  -- An outsider cannot log a read into A.
  perform set_config('test.uid', (select v from t where k = 'carol')::text, true);
  begin
    insert into doc_reads (workspace_id, doc_id)
    values ((select v from t where k = 'ws_a'), (select v from t where k = 'doc_a'));
    assert false, 'an outsider logged a read in another workspace';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

do $$
begin
  -- Start here is capped at three cards.
  begin
    update spaces set start_here = array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()]
    where id = (select v from t where k = 'space_a');
    assert false, 'start_here accepted a fourth card';
  exception when check_violation then null;
  end;
end $$;

rollback;
