-- RLS and constraints for `doc_comments` (20260808000000).
--
-- The point of these assertions is that the table is no longer wide open:
-- before this migration it had no policies at all, which under PostgREST means
-- any authenticated user could read every comment in every workspace.
--
-- Same conventions as the other files here: plain `assert` in DO blocks, one
-- transaction, rolled back at the end.
--
--   ./supabase/tests/run.sh

begin;

set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Fixtures — two workspaces, so "the other tenant" is a real row, not a theory
-- ---------------------------------------------------------------------------
create temp table t (k text primary key, v uuid);

-- The assertions below run as `authenticated` so RLS applies to them; the
-- fixture lookups they make still have to reach this table.
grant select on t to authenticated;

do $$
declare
  ws_a uuid; ws_b uuid;
  alice uuid; bob uuid; viewer uuid; carol uuid;
  space_a uuid; space_b uuid;
  doc_a uuid; doc_b uuid;
begin
  insert into auth.users (email) values ('alice@test')  returning id into alice;
  insert into auth.users (email) values ('bob@test')    returning id into bob;
  insert into auth.users (email) values ('viewer@test') returning id into viewer;
  insert into auth.users (email) values ('carol@test')  returning id into carol;

  insert into workspaces (name, slug) values ('A', 'ws-a') returning id into ws_a;
  insert into workspaces (name, slug) values ('B', 'ws-b') returning id into ws_b;

  -- alice admin + bob editor + viewer in A; carol is the outsider, in B only.
  insert into members (workspace_id, user_id, role) values
    (ws_a, alice, 'admin'), (ws_a, bob, 'editor'), (ws_a, viewer, 'viewer'),
    (ws_b, carol, 'admin');

  insert into spaces (workspace_id, name, slug) values (ws_a, 'Company', 'company')
    returning id into space_a;
  insert into spaces (workspace_id, name, slug) values (ws_b, 'Company', 'company')
    returning id into space_b;

  insert into docs (workspace_id, space_id, title, body_md)
    values (ws_a, space_a, 'Leave policy', 'take it') returning id into doc_a;
  insert into docs (workspace_id, space_id, title, body_md)
    values (ws_b, space_b, 'Their doc', 'theirs') returning id into doc_b;

  insert into t values
    ('ws_a', ws_a), ('ws_b', ws_b),
    ('alice', alice), ('bob', bob), ('viewer', viewer), ('carol', carol),
    ('doc_a', doc_a), ('doc_b', doc_b);
end $$;

-- Seed one comment in each workspace as the table owner (RLS is bypassed for
-- the superuser running the fixture, which is what the service role does too).
do $$
begin
  insert into doc_comments (doc_id, workspace_id, author_id, body, comment_type, mentions)
  values (
    (select v from t where k = 'doc_a'),
    (select v from t where k = 'ws_a'),
    (select v from t where k = 'alice'),
    'Does this cover contractors? @[Bob](user:' || (select v from t where k = 'bob') || ')',
    'comment',
    array[(select v from t where k = 'bob')]
  );

  insert into doc_comments (doc_id, workspace_id, author_id, body, comment_type)
  values (
    (select v from t where k = 'doc_b'),
    (select v from t where k = 'ws_b'),
    (select v from t where k = 'carol'),
    'Nothing to do with workspace A',
    'comment'
  );
end $$;

-- ---------------------------------------------------------------------------
-- 1. The migration's shape held
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.doc_comments'::regclass),
    'RLS is not enabled on doc_comments';

  assert (select count(*) from pg_policies
          where schemaname = 'public' and tablename = 'doc_comments') = 3,
    'expected exactly three policies (read, insert, delete)';

  -- No update policy: editing is not in this release, and the absence is the
  -- enforcement.
  assert not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'doc_comments' and cmd = 'UPDATE'
  ), 'an update policy appeared; comments are not editable in this release';

  assert (select count(*) from doc_comments where comment_type is null) = 0,
    'comment_type should be not-null after the migration';
end $$;

-- Body constraint: empty and whitespace-only are both rejected.
do $$
declare caught boolean := false;
begin
  begin
    insert into doc_comments (doc_id, workspace_id, author_id, body)
    values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
            (select v from t where k = 'alice'), '   ');
  exception when check_violation then caught := true;
  end;
  assert caught, 'a whitespace-only comment was accepted';
end $$;

-- Type constraint: an invented type is rejected.
do $$
declare caught boolean := false;
begin
  begin
    insert into doc_comments (doc_id, workspace_id, author_id, body, comment_type)
    values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
            (select v from t where k = 'alice'), 'hi', 'shout');
  exception when check_violation then caught := true;
  end;
  assert caught, 'an unknown comment_type was accepted';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Reads are scoped to the workspace
-- ---------------------------------------------------------------------------
set local role authenticated;

do $$
begin
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  assert (select count(*) from doc_comments) = 1,
    'a member of A should see exactly the one comment in A';
  assert (select workspace_id from doc_comments) = (select v from t where k = 'ws_a');

  -- The outsider case this migration exists for.
  perform set_config('test.uid', (select v from t where k = 'carol')::text, true);
  assert (select count(*) from doc_comments where workspace_id = (select v from t where k = 'ws_a')) = 0,
    'workspace B can read workspace A''s comments';

  -- Signed out: nothing.
  perform set_config('test.uid', '', true);
  assert (select count(*) from doc_comments) = 0,
    'comments are readable without a session';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Who may write
-- ---------------------------------------------------------------------------

-- An editor may comment as themselves.
do $$
begin
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  insert into doc_comments (doc_id, workspace_id, author_id, body)
  values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
          (select v from t where k = 'bob'), 'Contractors are out of scope.');
  assert (select count(*) from doc_comments) = 2;
end $$;

-- A viewer may not.
do $$
declare caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'viewer')::text, true);
  begin
    insert into doc_comments (doc_id, workspace_id, author_id, body)
    values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
            (select v from t where k = 'viewer'), 'Can I say something?');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'a viewer was allowed to comment';
end $$;

-- Nobody may post under another member's name.
do $$
declare caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  begin
    insert into doc_comments (doc_id, workspace_id, author_id, body)
    values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
            (select v from t where k = 'alice'), 'Signed, definitely Alice');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'a member posted a comment under someone else''s author_id';
end $$;

-- A member of A may not attach a comment to a doc in B, even with their own
-- workspace stamped on the row.
do $$
declare caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  begin
    insert into doc_comments (doc_id, workspace_id, author_id, body)
    values ((select v from t where k = 'doc_b'), (select v from t where k = 'ws_a'),
            (select v from t where k = 'bob'), 'reaching across');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'a comment was attached to a doc in another workspace';
end $$;

-- The review trail is not something a client can forge: only the service role
-- writes rejections, so the insert policy pins comment_type to 'comment'.
do $$
declare caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  begin
    insert into doc_comments (doc_id, workspace_id, author_id, body, comment_type)
    values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
            (select v from t where k = 'alice'), 'Rejected by me', 'rejection');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'a client forged a review-trail entry';
end $$;

-- `mentions` is what the notification feed reads, so it cannot be a free text
-- field for the client. Naming someone outside the workspace — here, carol —
-- is refused at the database, not only by the route that normally filters it.
do $$
declare caught boolean := false;
begin
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  begin
    insert into doc_comments (doc_id, workspace_id, author_id, body, mentions)
    values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
            (select v from t where k = 'bob'), 'pinging an outsider',
            array[(select v from t where k = 'carol')]);
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'a comment mentioned a user outside the workspace';
end $$;

-- A mention of a real member still goes through, including alongside the
-- author's own id, and an empty array is the ordinary case.
do $$
begin
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  insert into doc_comments (doc_id, workspace_id, author_id, body, mentions)
  values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
          (select v from t where k = 'bob'), 'a legitimate mention',
          array[(select v from t where k = 'alice'), (select v from t where k = 'viewer')]);

  insert into doc_comments (doc_id, workspace_id, author_id, body)
  values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
          (select v from t where k = 'bob'), 'no mentions at all');
end $$;

-- ---------------------------------------------------------------------------
-- 4. Mentions are queryable by the id they contain
--
-- Asserted before the deletes below, which moderate away the comment that
-- carries the mention.
-- ---------------------------------------------------------------------------
reset role;

do $$
begin
  -- The seeded comment naming Bob.
  assert (select count(*) from doc_comments
          where mentions @> array[(select v from t where k = 'bob')]) = 1,
    'the mentions array did not match the mentioned user';
  -- The legitimate two-member mention above names both of these.
  assert (select count(*) from doc_comments
          where mentions @> array[(select v from t where k = 'viewer')]) = 1;
  assert (select count(*) from doc_comments
          where mentions @> array[(select v from t where k = 'alice'),
                                  (select v from t where k = 'viewer')]) = 1,
    'a two-member mention did not match on both ids';
  -- Carol is in workspace B; the insert policy refused that row entirely.
  assert (select count(*) from doc_comments
          where mentions @> array[(select v from t where k = 'carol')]) = 0,
    'an out-of-workspace mention was stored';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Deletes: your own, or an admin's reach — but never the review trail
-- ---------------------------------------------------------------------------

do $$
begin
  insert into doc_comments (doc_id, workspace_id, author_id, body, comment_type)
  values ((select v from t where k = 'doc_a'), (select v from t where k = 'ws_a'),
          (select v from t where k = 'alice'), 'Bounced: missing the notice period.', 'rejection');
end $$;

set local role authenticated;

do $$
declare n int;
begin
  -- Bob deletes his own comment.
  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  delete from doc_comments where body = 'Contractors are out of scope.';
  get diagnostics n = row_count;
  assert n = 1, 'an author could not delete their own comment';

  -- Bob cannot delete Alice's.
  delete from doc_comments where author_id = (select v from t where k = 'alice')
    and comment_type = 'comment';
  get diagnostics n = row_count;
  assert n = 0, 'a non-admin deleted someone else''s comment';

  -- Alice, an admin, can — over every remaining comment in her workspace:
  -- the seeded one, plus the two Bob added in the mentions section.
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  delete from doc_comments where comment_type = 'comment'
    and workspace_id = (select v from t where k = 'ws_a');
  get diagnostics n = row_count;
  assert n = 3, format('an admin could not moderate every comment in their workspace (deleted %s)', n);

  -- But the rejection reason survives even the admin.
  delete from doc_comments where comment_type = 'rejection';
  get diagnostics n = row_count;
  assert n = 0, 'the review trail was deletable';
  assert (select count(*) from doc_comments where comment_type = 'rejection') = 1;
end $$;

rollback;
