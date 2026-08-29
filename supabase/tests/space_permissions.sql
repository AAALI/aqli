-- Private spaces (20260813000000).
--
-- The acceptance criterion is that a non-member cannot read a private space's
-- documents through *any* path, so this asserts the predicate every path is
-- built on, and then the policy composition on a table set up the way
-- production is: a permissive policy granting workspace members, plus the
-- restrictive one added by the migration.
--
-- The permissive policies on `docs` predate this repository's migrations
-- folder, so the fixture below recreates one rather than pretending it is
-- already here. That is the honest version: it proves the restrictive policy
-- narrows a grant, which is the only thing it is for.

begin;

set client_min_messages = warning;

create temporary table t (k text primary key, v uuid);

do $$
declare
  ws uuid; open_space uuid; hr_space uuid;
  alice uuid := gen_random_uuid();  -- admin, not in HR
  bea   uuid := gen_random_uuid();  -- in HR
  carl  uuid := gen_random_uuid();  -- another workspace entirely
  other_ws uuid;
begin
  insert into auth.users (id, email) values
    (alice, 'alice@example.test'), (bea, 'bea@example.test'), (carl, 'carl@example.test');

  insert into workspaces (name, slug) values ('Acme', 'acme-perm') returning id into ws;
  insert into workspaces (name, slug) values ('Other', 'other-perm') returning id into other_ws;
  insert into members (workspace_id, user_id, role) values (ws, alice, 'admin'), (ws, bea, 'editor');
  insert into members (workspace_id, user_id, role) values (other_ws, carl, 'admin');

  insert into spaces (workspace_id, name, slug) values (ws, 'Handbook', 'handbook')
    returning id into open_space;
  insert into spaces (workspace_id, name, slug, visibility) values (ws, 'People', 'people', 'private')
    returning id into hr_space;

  insert into space_members (workspace_id, space_id, user_id, role) values (ws, hr_space, bea, 'member');

  insert into docs (workspace_id, space_id, title, body_md) values (ws, open_space, 'Onboarding', 'x');
  insert into docs (workspace_id, space_id, title, body_md) values (ws, hr_space, 'Salary bands', 'secret');
  insert into docs (workspace_id, title, body_md) values (ws, 'Loose page', 'x');

  insert into t values ('ws', ws), ('open', open_space), ('hr', hr_space),
                       ('alice', alice), ('bea', bea), ('carl', carl);
end $$;

-- ---------------------------------------------------------------------------
-- 1. The predicate every path is built on
-- ---------------------------------------------------------------------------
do $$
declare
  hr    uuid := (select v from t where k = 'hr');
  open_ uuid := (select v from t where k = 'open');
  alice uuid := (select v from t where k = 'alice');
  bea   uuid := (select v from t where k = 'bea');
begin
  assert app.can_read_space(open_, alice), 'an open space is readable by any workspace member';
  assert app.can_read_space(hr, bea), 'a private space is readable by its members';
  assert not app.can_read_space(hr, alice),
    'a private space must not be readable by a non-member — being an admin is not membership';
  assert app.can_read_space(null, alice), 'a document with no space is workspace-wide';

  -- What the service-role paths filter on, since RLS does not apply to them.
  assert (select array_agg(id) from app.blocked_space_ids((select v from t where k = 'ws'), alice) as b(id))
         = array[hr], 'the blocked list should name exactly the private spaces the user is not in';
  assert (select count(*) from app.blocked_space_ids((select v from t where k = 'ws'), bea)) = 0,
    'a member of every private space is blocked from none';
end $$;

-- ---------------------------------------------------------------------------
-- 2. The policy composition, on a table set up the way production is
-- ---------------------------------------------------------------------------
do $$
declare
  visible int;
begin
  -- Production's permissive policy, recreated: workspace members read their
  -- workspace's documents. The migration's restrictive policy is already there.
  execute 'alter table docs enable row level security';
  execute 'create policy docs_member_read on docs for select to authenticated using ( (select app.is_member(workspace_id)) )';

  -- The policies are checked against a role, so the assertions below run as
  -- one: `authenticated`, with `test.uid` naming the person.
  execute 'grant select on docs to authenticated';

  -- Alice: admin of the workspace, not a member of People.
  perform set_config('test.uid', (select v::text from t where k = 'alice'), true);
  set local role authenticated;
  select count(*) into visible from docs;
  reset role;
  assert visible = 2, format('a non-member should see the open and unspaced docs only, saw %s', visible);

  perform set_config('test.uid', (select v::text from t where k = 'alice'), true);
  set local role authenticated;
  select count(*) into visible from docs where title = 'Salary bands';
  reset role;
  assert visible = 0, 'a private space''s documents must not be readable by a non-member';

  -- Bea: a member of People.
  perform set_config('test.uid', (select v::text from t where k = 'bea'), true);
  set local role authenticated;
  select count(*) into visible from docs;
  reset role;
  assert visible = 3, format('a member of the private space should see everything, saw %s', visible);

  -- Carl: a different workspace. The tenancy boundary still does its job.
  perform set_config('test.uid', (select v::text from t where k = 'carl'), true);
  set local role authenticated;
  select count(*) into visible from docs;
  reset role;
  assert visible = 0, 'another workspace must see nothing';
end $$;

-- ---------------------------------------------------------------------------
-- 3. No title or existence leak
-- ---------------------------------------------------------------------------
--
-- The acceptance criterion says a question answerable only from a private space
-- returns nothing for a non-member — not a redacted row, not a title.
do $$
declare titles text[];
begin
  perform set_config('test.uid', (select v::text from t where k = 'alice'), true);
  set local role authenticated;
  select array_agg(title::text) into titles from docs;
  reset role;

  assert not (titles @> array['Salary bands']),
    format('a private document''s title leaked to a non-member: %s', titles);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Reviewers
-- ---------------------------------------------------------------------------
do $$
declare
  hr    uuid := (select v from t where k = 'hr');
  open_ uuid := (select v from t where k = 'open');
  alice uuid := (select v from t where k = 'alice');
  bea   uuid := (select v from t where k = 'bea');
begin
  assert not app.space_has_reviewers(hr),
    'a space names no reviewers until someone names one — turning this on is deliberate';
  assert not app.is_space_reviewer(hr, bea), 'a plain member is not a reviewer';

  update space_members set role = 'reviewer' where space_id = hr and user_id = bea;

  assert app.space_has_reviewers(hr), 'the space now names a reviewer';
  assert app.is_space_reviewer(hr, bea), 'the named reviewer may approve';
  assert not app.is_space_reviewer(hr, alice),
    'an admin who is not a named reviewer may not approve in a space that names them';
  assert not app.space_has_reviewers(open_),
    'naming a reviewer in one space must not change any other space';
end $$;

-- ---------------------------------------------------------------------------
-- 5. space_members is a tenant-scoped table like every other
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.space_members'::regclass),
    'RLS is not enabled on space_members';
  assert (select count(*) from pg_policies
          where schemaname = 'public' and tablename = 'space_members') = 2,
    'expected a read policy and an admin-write policy';
end $$;

rollback;
