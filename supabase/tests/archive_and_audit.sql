-- Archiving and the audit log (20260925000000).
--
-- A page archives with its sub-pages and restores with them, to the status it
-- had. The audit log is readable by admins only, writable by nobody on a
-- client, and append-only for everyone — until its workspace is deleted.
--
--   ./supabase/tests/run.sh

begin;

set client_min_messages = warning;

create temp table t (k text primary key, v uuid);
grant select on t to authenticated;

do $$
declare
  ws uuid; alice uuid; bob uuid; sp uuid;
  top uuid; kid uuid; grandkid uuid; loner uuid; draft uuid;
  ids uuid[]; caught boolean; stamp timestamptz;
begin
  insert into auth.users (email) values ('alice@test') returning id into alice;
  insert into auth.users (email) values ('bob@test')   returning id into bob;
  insert into workspaces (name, slug) values ('Audit', 'audit-test') returning id into ws;
  insert into members (workspace_id, user_id, role) values (ws, alice, 'admin'), (ws, bob, 'editor');
  insert into spaces (workspace_id, name, slug) values (ws, 'Handbook', 'handbook') returning id into sp;

  insert into docs (workspace_id, space_id, title, body_md, status, owner_id)
    values (ws, sp, 'Benefits', 'x', 'approved', alice) returning id into top;
  insert into docs (workspace_id, space_id, title, body_md, status, owner_id, parent_doc_id)
    values (ws, sp, 'Leave', 'x', 'review', alice, top) returning id into kid;
  insert into docs (workspace_id, space_id, title, body_md, status, owner_id, parent_doc_id)
    values (ws, sp, 'Parental leave', 'x', 'approved', alice, kid) returning id into grandkid;
  insert into docs (workspace_id, space_id, title, body_md, status, owner_id)
    values (ws, sp, 'Loner', 'x', 'approved', alice) returning id into loner;
  insert into docs (workspace_id, space_id, title, body_md, status, owner_id)
    values (ws, sp, 'Half a thought', 'x', 'draft', alice) returning id into draft;

  update docs set updated_at = '2026-01-01T00:00:00Z' where id = kid;

  -- --- archiving takes the subtree -----------------------------------------
  ids := public.set_doc_archived(top, true);
  assert cardinality(ids) = 3, format('expected 3 archived, got %s', cardinality(ids));
  assert (select count(*) from docs where status = 'archived') = 3, 'subtree not archived';
  assert (select status_before_archive from docs where id = kid) = 'review', 'prior status not kept';
  assert (select updated_at from docs where id = kid) = '2026-01-01T00:00:00Z'::timestamptz,
    'archiving restamped updated_at';

  -- Archiving again is a no-op, not an error.
  assert cardinality(public.set_doc_archived(top, true)) = 0, 'second archive changed something';

  -- --- a draft is discarded, not archived ----------------------------------
  caught := false;
  begin
    perform public.set_doc_archived(draft, true);
  exception when invalid_parameter_value then caught := true;
  end;
  assert caught, 'a draft was archived';

  -- --- restore brings back what went together, at its old status -----------
  ids := public.set_doc_archived(top, false);
  assert cardinality(ids) = 3, format('expected 3 restored, got %s', cardinality(ids));
  assert (select status from docs where id = kid) = 'review', 'restore lost the prior status';
  assert (select count(*) from docs where archived_at is not null) = 0, 'archive stamps left behind';

  -- --- restoring a child whose parent is still archived lifts it to the top -
  perform public.set_doc_archived(kid, true);
  perform public.set_doc_archived(top, true);
  -- `top` was archived later than `kid`, so restoring top leaves kid archived.
  ids := public.set_doc_archived(top, false);
  assert cardinality(ids) = 1, format('expected only top restored, got %s', cardinality(ids));
  assert (select status from docs where id = kid) = 'archived', 'an earlier archive came back with a later one';
  perform public.set_doc_archived(top, true);
  perform public.set_doc_archived(kid, false);
  assert (select parent_doc_id from docs where id = kid) is null,
    'a page restored under an archived parent stayed hidden under it';

  -- --- the audit log -------------------------------------------------------
  insert into audit_events (workspace_id, actor_type, actor_id, action, target_type, target_id, target_label)
    values (ws, 'human', alice, 'doc.deleted', 'doc', loner::text, 'Loner');
  delete from docs where id = loner;
  assert (select count(*) from audit_events where action = 'doc.deleted') = 1,
    'the record of a deletion went with the document';

  caught := false;
  begin
    update audit_events set actor_name = 'someone else';
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'an audit event was rewritten';

  caught := false;
  begin
    delete from audit_events;
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'an audit event was deleted';

  insert into t values ('ws', ws), ('alice', alice), ('bob', bob);
end $$;

set local role authenticated;

do $$
declare caught boolean;
begin
  perform set_config('test.uid', (select v from t where k = 'alice')::text, true);
  assert (select count(*) from audit_events) = 1, 'an admin cannot read the audit log';

  perform set_config('test.uid', (select v from t where k = 'bob')::text, true);
  assert (select count(*) from audit_events) = 0, 'an editor can read the audit log';

  caught := false;
  begin
    insert into audit_events (workspace_id, actor_type, action, target_type)
      values ((select v from t where k = 'ws'), 'human', 'doc.deleted', 'doc');
  exception when insufficient_privilege then caught := true;
  end;
  assert caught, 'a client forged an audit event';
end $$;

reset role;

-- --- deleting the workspace takes its log with it ---------------------------
do $$
begin
  delete from workspaces where id = (select v from t where k = 'ws');
  assert (select count(*) from audit_events where workspace_id = (select v from t where k = 'ws')) = 0,
    'the workspace cascade was refused';
end $$;

rollback;
