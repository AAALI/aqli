-- Step 6: `body_md` becomes the source of truth (spec §9, step 6).
--
-- The one-way door. After this the editor reads markdown and parses it into a
-- Tiptap tree on the way in; `body_json` is a cache of that tree, written on
-- save so the editor has something to open without a parse, and read by
-- nothing that matters. Anything only in `body_json` from here on is lost.
--
-- Which is why this refuses to apply until the step-2.5 backfill has run. See
-- `20260805035000_migration_gates.sql` for why the check is a table row rather
-- than a note in a handover document.

begin;

-- ---------------------------------------------------------------------------
-- Preconditions
-- ---------------------------------------------------------------------------
do $$
declare
  gate      app.migration_gates%rowtype;
  at_risk   bigint;
begin
  select * into gate from app.migration_gates where name = 'body_md_backfill';
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'step 6 blocked: the body_md backfill has not run',
      detail  = 'Every body_md in this database was written by the old converter, which drops text that only survives in body_json. Flipping now makes that loss permanent.',
      hint    = 'Run `pnpm backfill:markdown` (dry run), read reports/markdown-backfill.md, then `pnpm backfill:markdown -- --apply`. It records the gate on a clean run.';
  end if;

  -- Independent of the gate: a document whose markdown is empty while its JSON
  -- is not would be blanked by this migration. One such row existed on the
  -- production copy when this was written.
  select count(*) into at_risk
  from docs
  where body_json is not null
    and body_json::text not in ('{"type":"doc"}', '{"type": "doc"}')
    and coalesce(body_md, '') = '';

  if at_risk > 0 then
    raise exception using
      errcode = 'P0001',
      message = format('step 6 blocked: %s document(s) have content in body_json and none in body_md', at_risk),
      detail  = 'Flipping would leave those documents empty.',
      hint    = 'Re-run the backfill, or fix the rows by hand, before applying this.';
  end if;

  raise notice 'body_md backfill gate recorded at %', gate.recorded_at;
end $$;

-- ---------------------------------------------------------------------------
-- The flip
-- ---------------------------------------------------------------------------

-- `body_md` is now the column the application cannot do without. A null here
-- used to mean "look at body_json"; it now means "this document has no body",
-- which is a state the empty string already expresses.
update docs set body_md = '' where body_md is null;

alter table docs
  alter column body_md set default '',
  alter column body_md set not null;

comment on column docs.body_md is
  'Canonical. The document. Everything else about the body — body_text, headings, search_vector, body_json — is derived from this.';
comment on column docs.body_json is
  'Derived cache of the Tiptap tree for body_md, written on save so the editor opens without a parse. Never the source of truth: anything present only here is lost.';

-- `revisions` is the history the application reads from step 6 on.
-- `doc_versions` is left in place, untouched: it is what `revisions` was
-- backfilled from, and keeping it costs nothing next to being unable to check
-- the backfill afterwards. Dropping it is a later cleanup.
comment on table doc_versions is
  'Superseded by `revisions` (step 3 backfilled from here). Read by nothing since step 6. Still written on status changes and by the direct-write path AQLI_MERGE_ENGINE=0 falls back to, which is the only history that path produces.';

commit;
