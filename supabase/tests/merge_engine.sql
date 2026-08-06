-- Integration test for the step-4 merge engine (spec §3).
--
-- Dependency-free on purpose: plain `assert` inside DO blocks, no pgTAP. Run
-- it against a scratch database that has every migration applied:
--
--   ./supabase/tests/run.sh
--
-- The whole file runs in one transaction and rolls back, so it is also safe to
-- point at a branch database.

begin;

set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
create temp table t (k text primary key, v uuid);

do $$
declare
  ws uuid; alice uuid; bob uuid; viewer uuid;
  s_open uuid; s_agents uuid; s_all uuid;
  k_propose uuid; k_write uuid;
begin
  insert into auth.users (email) values ('alice@test') returning id into alice;
  insert into auth.users (email) values ('bob@test')   returning id into bob;
  insert into auth.users (email) values ('v@test')     returning id into viewer;

  insert into workspaces (name, slug) values ('Test', 'test') returning id into ws;
  insert into members (workspace_id, user_id, role) values
    (ws, alice, 'admin'), (ws, bob, 'editor'), (ws, viewer, 'viewer');

  insert into spaces (workspace_id, name, slug, review_policy)
  values (ws, 'Open', 'open', 'open') returning id into s_open;
  insert into spaces (workspace_id, name, slug, review_policy)
  values (ws, 'Agents', 'agents', 'review_agents') returning id into s_agents;
  insert into spaces (workspace_id, name, slug, review_policy)
  values (ws, 'All', 'all', 'review_all') returning id into s_all;

  insert into api_keys (workspace_id, name, key_hash, key_prefix, owner_user_id, scopes)
  values (ws, 'propose-only', 'h1', 'aqli_1', alice, '{read,propose}')
  returning id into k_propose;
  insert into api_keys (workspace_id, name, key_hash, key_prefix, owner_user_id, scopes)
  values (ws, 'writer', 'h2', 'aqli_2', alice, '{read,propose,write}')
  returning id into k_write;

  insert into t values
    ('ws', ws), ('alice', alice), ('bob', bob), ('viewer', viewer),
    ('s_open', s_open), ('s_agents', s_agents), ('s_all', s_all),
    ('k_propose', k_propose), ('k_write', k_write);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Disposition truth table (spec §3.1)
-- ---------------------------------------------------------------------------
do $$
declare
  propose agent_scope[] := '{read,propose}';
  writer  agent_scope[] := '{read,propose,write}';
begin
  -- Records are never reviewed, whatever the policy or the actor.
  assert app.decide_disposition('review_all',    'human', null,    'record') = 'merge';
  assert app.decide_disposition('review_all',    'agent', propose, 'record') = 'merge';
  assert app.decide_disposition('review_agents', 'agent', propose, 'record') = 'merge';

  -- open: everything merges.
  assert app.decide_disposition('open', 'human',  null,    'canon') = 'merge';
  assert app.decide_disposition('open', 'agent',  propose, 'canon') = 'merge';
  assert app.decide_disposition('open', 'system', null,    'canon') = 'merge';

  -- review_all: everything queues, humans included. That is the point of a
  -- compliance space.
  assert app.decide_disposition('review_all', 'human',  null,   'canon') = 'queue';
  assert app.decide_disposition('review_all', 'agent',  writer, 'canon') = 'queue';
  assert app.decide_disposition('review_all', 'system', null,   'canon') = 'queue';

  -- review_agents: people write freely, agents need the write scope.
  assert app.decide_disposition('review_agents', 'human',  null,    'canon') = 'merge';
  assert app.decide_disposition('review_agents', 'agent',  writer,  'canon') = 'merge';
  assert app.decide_disposition('review_agents', 'agent',  propose, 'canon') = 'queue';
  assert app.decide_disposition('review_agents', 'agent',  null,    'canon') = 'queue';
  assert app.decide_disposition('review_agents', 'system', null,    'canon') = 'queue';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Human write into an `open` space merges and creates the document
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; d docs%rowtype; rev revisions%rowtype;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);

  r := app.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'Runbook',
    p_body_md      => '# Runbook' || chr(10) || chr(10) || 'Restart the thing.',
    p_space_id     => (select v from t where k = 's_open'),
    p_body_json    => '{"type":"doc"}'::jsonb,
    p_frontmatter  => '{"tags":["ops"],"doc_type":"runbook"}'::jsonb
  );

  assert r->>'state' = 'merged',       format('expected merged, got %s', r);
  assert (r->>'auto_merged')::boolean, 'open space should auto-merge';
  assert r->>'document_id' is not null, 'merge must produce a document';

  select * into d from docs where id = (r->>'document_id')::uuid;
  assert d.title = 'Runbook';
  assert d.type = 'runbook',            format('doc_type control key ignored: %s', d.type);
  assert d.status = 'draft',            format('unexpected status %s', d.status);
  assert d.author_type = 'human';
  assert d.origin = 'human';
  assert d.doc_class = 'canon';
  assert d.owner_id = (select v from t where k = 'alice');
  assert d.body_json = '{"type":"doc"}'::jsonb, 'body_json must pass through';
  assert d.body_text like '%Restart the thing%', 'derived body_text not maintained';
  assert d.headings = 'Runbook',        format('derived headings wrong: %s', d.headings);
  assert d.last_reviewed_at is null,    'a content merge must not reset the staleness clock';
  assert d.current_revision_id is not null;

  select * into rev from revisions where id = d.current_revision_id;
  assert rev.seq = 1;
  assert rev.parent_revision_id is null;
  assert rev.proposal_id = (r->>'proposal_id')::uuid;
  assert rev.author_id = (select v from t where k = 'alice');

  insert into t values ('doc1', d.id);
end $$;

-- ---------------------------------------------------------------------------
-- 3. A second save chains a revision rather than replacing one
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; d docs%rowtype; rev revisions%rowtype; prev uuid;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  select current_revision_id into prev from docs where id = (select v from t where k = 'doc1');

  r := app.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'Runbook v2',
    p_body_md      => '# Runbook' || chr(10) || chr(10) || 'Restart it twice.',
    p_document_id  => (select v from t where k = 'doc1')
  );

  assert r->>'state' = 'merged';
  select * into d from docs where id = (select v from t where k = 'doc1');
  assert d.title = 'Runbook v2';
  assert d.body_json = '{"type":"doc"}'::jsonb,
    'a proposal with no body_json must leave the cached Tiptap tree alone';

  select * into rev from revisions where id = d.current_revision_id;
  assert rev.seq = 2,                       format('expected seq 2, got %s', rev.seq);
  assert rev.parent_revision_id = prev,     'revision chain broken';
  assert (select count(*) from revisions where document_id = d.id) = 2;
end $$;

-- ---------------------------------------------------------------------------
-- 4. review_all queues a human write and leaves the document untouched
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; before_title text;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  select title into before_title from docs where id = (select v from t where k = 'doc1');

  update docs set space_id = (select v from t where k = 's_all')
  where id = (select v from t where k = 'doc1');

  r := app.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'Should be queued',
    p_body_md      => 'pending',
    p_document_id  => (select v from t where k = 'doc1')
  );

  assert r->>'state' = 'open',              format('expected queued, got %s', r);
  assert not (r->>'auto_merged')::boolean;
  assert (select title from docs where id = (select v from t where k = 'doc1')) = before_title,
    'a queued proposal must not touch the document';

  insert into t values ('queued', (r->>'proposal_id')::uuid);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Approving a queued proposal merges it and stamps last_reviewed_at
-- ---------------------------------------------------------------------------
do $$
declare doc_id uuid; d docs%rowtype; p proposals%rowtype;
begin
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  doc_id := app.merge_proposal(
    (select v from t where k = 'queued'),
    (select v from t where k = 'bob'),
    true
  );

  assert doc_id = (select v from t where k = 'doc1');
  select * into d from docs where id = doc_id;
  assert d.title = 'Should be queued';
  assert d.last_reviewed_at is not null, 'an approval should reset the staleness clock';

  select * into p from proposals where id = (select v from t where k = 'queued');
  assert p.state = 'merged';
  assert p.reviewed_by = (select v from t where k = 'bob');
  assert p.reviewed_at is not null;
end $$;

-- ---------------------------------------------------------------------------
-- 6. A viewer cannot merge or reject
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  r := app.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'Viewer test',
    p_body_md      => 'x',
    p_document_id  => (select v from t where k = 'doc1')
  );
  insert into t values ('viewer_prop', (r->>'proposal_id')::uuid);

  perform set_config('test.uid', (select v from t where k = 'viewer')::text, true);
  begin
    perform app.merge_proposal((select v from t where k = 'viewer_prop'));
  exception when sqlstate 'P0003' then caught := true;
  end;
  assert caught, 'a viewer must not be able to merge';

  caught := false;
  begin
    perform app.reject_proposal((select v from t where k = 'viewer_prop'));
  exception when sqlstate 'P0003' then caught := true;
  end;
  assert caught, 'a viewer must not be able to reject';
end $$;

-- ---------------------------------------------------------------------------
-- 7. Optimistic concurrency: an explicit stale base is refused
-- ---------------------------------------------------------------------------
-- 7a. Two writers read the same revision. The second is refused, and nothing
--     of its proposal survives.
do $$
declare base uuid; p1 jsonb; caught boolean := false; before_count bigint;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  -- Merge the leftover viewer proposal so the queue is clean.
  perform app.merge_proposal((select v from t where k = 'viewer_prop'),
                             (select v from t where k = 'alice'));

  update docs set space_id = (select v from t where k = 's_open')
  where id = (select v from t where k = 'doc1');
  select current_revision_id into base from docs where id = (select v from t where k = 'doc1');
  select count(*) into before_count from proposals;

  p1 := app.submit_proposal(
    p_workspace_id     => (select v from t where k = 'ws'),
    p_title            => 'Writer one',
    p_body_md          => 'one',
    p_document_id      => (select v from t where k = 'doc1'),
    p_base_revision_id => base
  );
  assert p1->>'state' = 'merged', 'first writer should win';

  begin
    perform app.submit_proposal(
      p_workspace_id     => (select v from t where k = 'ws'),
      p_title            => 'Writer two',
      p_body_md          => 'two',
      p_document_id      => (select v from t where k = 'doc1'),
      p_base_revision_id => base
    );
  exception when sqlstate 'P0002' then caught := true;
  end;

  assert caught, 'the second writer on a stale base must be refused';
  assert (select count(*) from proposals) = before_count + 1,
    'a refused submit must not leave a proposal behind';
  assert (select title from docs where id = (select v from t where k = 'doc1')) = 'Writer one';
end $$;

-- 7b. A queued proposal written against an older revision is refused at merge
--     time, not at submit time. The reviewer gets the 409; the author rebases.
--     (A rival on the *same* base is superseded instead — see test 8.)
do $$
declare old_base uuid; stale_prop uuid; caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);

  -- The document is at its current head; `old_base` is one behind.
  select parent_revision_id into old_base
  from revisions where id = (select current_revision_id from docs
                             where id = (select v from t where k = 'doc1'));
  assert old_base is not null, 'fixture needs at least two revisions';

  update docs set space_id = (select v from t where k = 's_all')
  where id = (select v from t where k = 'doc1');

  stale_prop := (app.submit_proposal(
    p_workspace_id     => (select v from t where k = 'ws'),
    p_title            => 'Written against the old base',
    p_body_md          => 'old',
    p_document_id      => (select v from t where k = 'doc1'),
    p_base_revision_id => old_base
  )->>'proposal_id')::uuid;

  begin
    perform app.merge_proposal(stale_prop, (select v from t where k = 'alice'));
  exception when sqlstate 'P0002' then caught := true;
  end;
  assert caught, 'merging a proposal whose base has moved must raise stale_base';
  assert (select state from proposals where id = stale_prop) = 'open',
    'a refused merge must leave the proposal open for the author to rebase';
end $$;

-- ---------------------------------------------------------------------------
-- 8. Superseding: merging one open proposal invalidates its rivals
-- ---------------------------------------------------------------------------
do $$
declare a jsonb; b jsonb; base uuid; caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  update docs set space_id = (select v from t where k = 's_all')
  where id = (select v from t where k = 'doc1');
  select current_revision_id into base from docs where id = (select v from t where k = 'doc1');

  a := app.submit_proposal(
    p_workspace_id     => (select v from t where k = 'ws'),
    p_title            => 'Rival A',
    p_body_md          => 'a',
    p_document_id      => (select v from t where k = 'doc1'),
    p_base_revision_id => base
  );
  b := app.submit_proposal(
    p_workspace_id     => (select v from t where k = 'ws'),
    p_title            => 'Rival B',
    p_body_md          => 'b',
    p_document_id      => (select v from t where k = 'doc1'),
    p_base_revision_id => base
  );
  assert a->>'state' = 'open' and b->>'state' = 'open';

  perform app.merge_proposal((a->>'proposal_id')::uuid, (select v from t where k = 'alice'));

  assert (select state from proposals where id = (a->>'proposal_id')::uuid) = 'merged';
  assert (select state from proposals where id = (b->>'proposal_id')::uuid) = 'superseded',
    'a rival on the same base must be superseded, not left open';

  -- And merging the superseded one is refused.
  begin
    perform app.merge_proposal((b->>'proposal_id')::uuid);
  exception when sqlstate 'P0001' then caught := true;
  end;
  assert caught, 'a superseded proposal must not be mergeable';
end $$;

-- ---------------------------------------------------------------------------
-- 9. Reject
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; p proposals%rowtype; base uuid; caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  r := app.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'To reject',
    p_body_md      => 'nope',
    p_document_id  => (select v from t where k = 'doc1')
  );
  assert r->>'state' = 'open';

  perform app.reject_proposal((r->>'proposal_id')::uuid,
                              (select v from t where k = 'bob'),
                              'Not accurate');

  select * into p from proposals where id = (r->>'proposal_id')::uuid;
  assert p.state = 'rejected';
  assert p.review_note = 'Not accurate';
  assert p.reviewed_by = (select v from t where k = 'bob');

  -- Rejecting twice is refused rather than silently re-stamping.
  begin
    perform app.reject_proposal((r->>'proposal_id')::uuid);
  exception when sqlstate 'P0001' then caught := true;
  end;
  assert caught;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Agent writes: scope decides, and a record bypasses review
-- ---------------------------------------------------------------------------
do $$
declare r jsonb;
begin
  -- Service-role path: no auth.uid().
  perform set_config('test.uid', '', true);

  -- propose-only key into a review_agents space -> queued.
  r := app.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'Agent note',
    p_body_md      => 'agent body',
    p_space_id     => (select v from t where k = 's_agents'),
    p_agent_key_id => (select v from t where k = 'k_propose'),
    p_frontmatter  => '{"agent_id":"claude"}'::jsonb
  );
  assert r->>'state' = 'open',        format('propose-only key should queue, got %s', r);
  assert r->>'document_id' is null,   'a queued new-document proposal must not create the document';

  -- write-scoped key into the same space -> merged.
  r := app.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'Agent trusted',
    p_body_md      => 'trusted body',
    p_space_id     => (select v from t where k = 's_agents'),
    p_agent_key_id => (select v from t where k = 'k_write'),
    p_frontmatter  => '{"agent_id":"claude","doc_status":"approved"}'::jsonb
  );
  assert r->>'state' = 'merged',      format('write-scoped key should merge, got %s', r);
  assert (select author_type from docs where id = (r->>'document_id')::uuid) = 'agent';
  assert (select origin      from docs where id = (r->>'document_id')::uuid) = 'agent';
  assert (select agent_id    from docs where id = (r->>'document_id')::uuid) = 'claude';
  assert (select status      from docs where id = (r->>'document_id')::uuid) = 'approved';

  -- A record merges even under review_all.
  r := app.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'PR #12 merged',
    p_body_md      => 'shipped',
    p_space_id     => (select v from t where k = 's_all'),
    p_agent_key_id => (select v from t where k = 'k_propose'),
    p_frontmatter  => '{"doc_class":"record"}'::jsonb
  );
  assert r->>'state' = 'merged',      'records are never queued';
  assert (select doc_class from docs where id = (r->>'document_id')::uuid) = 'record';
end $$;

-- ---------------------------------------------------------------------------
-- 11. Idempotency: a retried write replays the first outcome
-- ---------------------------------------------------------------------------
do $$
declare first jsonb; again jsonb;
begin
  perform set_config('test.uid', '', true);
  first := app.submit_proposal(
    p_workspace_id    => (select v from t where k = 'ws'),
    p_title           => 'Idempotent',
    p_body_md         => 'once',
    p_space_id        => (select v from t where k = 's_open'),
    p_agent_key_id    => (select v from t where k = 'k_propose'),
    p_idempotency_key => 'abc-123'
  );
  again := app.submit_proposal(
    p_workspace_id    => (select v from t where k = 'ws'),
    p_title           => 'Idempotent (retry)',
    p_body_md         => 'twice',
    p_space_id        => (select v from t where k = 's_open'),
    p_agent_key_id    => (select v from t where k = 'k_propose'),
    p_idempotency_key => 'abc-123'
  );

  assert first->>'proposal_id' = again->>'proposal_id', 'retry created a second proposal';
  assert (again->>'replayed')::boolean;
  assert (select count(*) from docs where title = 'Idempotent') = 1;
  assert (select count(*) from docs where title = 'Idempotent (retry)') = 0;
end $$;

-- ---------------------------------------------------------------------------
-- 12. Cross-workspace writes are refused
-- ---------------------------------------------------------------------------
do $$
declare other_ws uuid; caught boolean := false;
begin
  insert into workspaces (name, slug) values ('Other', 'other') returning id into other_ws;
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  begin
    perform app.submit_proposal(
      p_workspace_id => other_ws,
      p_title        => 'Trespass',
      p_body_md      => 'x'
    );
  exception when sqlstate 'P0003' then caught := true;
  end;
  assert caught, 'a non-member must not be able to propose into another workspace';

  -- And a document from another workspace cannot be targeted.
  caught := false;
  begin
    perform app.submit_proposal(
      p_workspace_id => other_ws,
      p_title        => 'Trespass 2',
      p_body_md      => 'x',
      p_document_id  => (select v from t where k = 'doc1')
    );
  exception when sqlstate 'P0003' then caught := true;
         when sqlstate 'P0004' then caught := true;
  end;
  assert caught;
end $$;

-- ---------------------------------------------------------------------------
-- 13. The public shims PostgREST calls are wired to the app functions
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; pid uuid;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);

  r := public.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'Via the shim',
    p_body_md      => 'shimmed',
    p_space_id     => (select v from t where k = 's_all')
  );
  assert r->>'state' = 'open', format('shim did not queue: %s', r);
  pid := (r->>'proposal_id')::uuid;

  assert public.merge_proposal(pid, (select v from t where k = 'alice')) is not null;
  assert (select state from proposals where id = pid) = 'merged';

  r := public.submit_proposal(
    p_workspace_id => (select v from t where k = 'ws'),
    p_title        => 'Via the shim, rejected',
    p_body_md      => 'shimmed',
    p_space_id     => (select v from t where k = 's_all')
  );
  perform public.reject_proposal((r->>'proposal_id')::uuid,
                                 (select v from t where k = 'alice'), 'no');
  assert (select state from proposals where id = (r->>'proposal_id')::uuid) = 'rejected';
end $$;

rollback;
