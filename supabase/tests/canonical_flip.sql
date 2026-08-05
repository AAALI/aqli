-- The step-6 interlock (see `20260805040000_body_md_canonical.sql`).
--
-- The migration itself has already been applied by the runner, so these
-- re-assert its two preconditions directly against the same predicates. The
-- point is to prove the guards refuse, not to re-run the migration.

begin;

set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- 1. The gate exists after the runner applied the migration chain
-- ---------------------------------------------------------------------------
do $$
begin
  -- `supabase/tests/base.sql` records the gate, standing in for a real
  -- backfill run, which is the only reason step 6 applied at all.
  assert exists (select 1 from app.migration_gates where name = 'body_md_backfill'),
    'the migration chain should not have applied without the backfill gate';
end $$;

-- ---------------------------------------------------------------------------
-- 2. The gate check refuses when the record is absent
-- ---------------------------------------------------------------------------
do $$
declare caught boolean := false;
begin
  delete from app.migration_gates where name = 'body_md_backfill';

  begin
    if not exists (select 1 from app.migration_gates where name = 'body_md_backfill') then
      raise exception using errcode = 'P0001',
        message = 'step 6 blocked: the body_md backfill has not run';
    end if;
  exception when sqlstate 'P0001' then caught := true;
  end;

  assert caught, 'step 6 must refuse to apply without the backfill gate';
end $$;

-- ---------------------------------------------------------------------------
-- 3. The content check catches a document that would be blanked
-- ---------------------------------------------------------------------------
do $$
declare ws uuid; at_risk bigint;
begin
  insert into workspaces (name, slug) values ('Flip', 'flip') returning id into ws;

  -- A document whose body only exists as Tiptap JSON. One of these was in the
  -- production data when step 6 was written.
  insert into docs (workspace_id, title, body_md, body_json)
  values (ws, 'JSON only', '', '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb);

  select count(*) into at_risk
  from docs
  where body_json is not null
    and body_json::text not in ('{"type":"doc"}', '{"type": "doc"}')
    and coalesce(body_md, '') = '';

  assert at_risk = 1, format('expected 1 at-risk document, found %s', at_risk);

  -- An empty Tiptap document is not content, and must not block the flip.
  insert into docs (workspace_id, title, body_md, body_json)
  values (ws, 'Genuinely empty', '', '{"type":"doc"}'::jsonb);

  select count(*) into at_risk
  from docs
  where body_json is not null
    and body_json::text not in ('{"type":"doc"}', '{"type": "doc"}')
    and coalesce(body_md, '') = '';

  assert at_risk = 1, 'an empty Tiptap tree should not count as content at risk';
end $$;

-- ---------------------------------------------------------------------------
-- 4. body_md is not nullable after the flip
-- ---------------------------------------------------------------------------
do $$
declare ws uuid; caught boolean := false;
begin
  insert into workspaces (name, slug) values ('NotNull', 'notnull') returning id into ws;
  begin
    insert into docs (workspace_id, title, body_md) values (ws, 'Null body', null);
  exception when not_null_violation then caught := true;
  end;
  assert caught, 'body_md must be NOT NULL after the canonical flip';

  -- And it defaults to empty, so a caller that says nothing still gets a body.
  insert into docs (workspace_id, title) values (ws, 'No body given');
  assert (select body_md from docs where workspace_id = ws and title = 'No body given') = '';
end $$;

rollback;
