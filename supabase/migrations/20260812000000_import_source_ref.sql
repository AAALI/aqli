-- Import idempotency, enforced by the database (ADOPTION.md F-1).
--
-- Re-running an import must fix rather than duplicate. That is a promise the
-- importer cannot keep on its own: an import of 1,361 pages that dies at page
-- 900 is exactly when someone re-runs it, and exactly when a bug in the "have I
-- seen this page?" check turns into 900 duplicate documents nobody wants to
-- delete by hand.
--
-- So the source reference is a column with a unique index on it. The importer
-- looks up by it, and if the lookup is ever wrong the insert fails rather than
-- succeeding twice.
--
-- `docs.source_ref` already exists (spec §2.2) and has been unused. It is the
-- right home: the same shape serves the PR ingester, and `origin = 'system'`
-- already distinguishes a machine writer that no person holds a key for.

begin;

-- One document per source page, per workspace. Partial, so the 27 documents
-- that predate any import — and every document written by hand since — are
-- unaffected by a uniqueness rule about a field they do not have.
create unique index if not exists docs_source_ref_unique
  on docs (
    workspace_id,
    (source_ref ->> 'source'),
    (source_ref ->> 'id')
  )
  where source_ref ? 'source' and source_ref ? 'id';

comment on column docs.source_ref is
  'Where an imported document came from: {"source": "confluence", "id": "<page id>"}. Unique per workspace, which is what makes a re-run update rather than duplicate.';

-- Looking a page up by its source id is the importer's hot path — once per
-- page, before deciding to create or update.
create index if not exists docs_source_ref_lookup
  on docs using gin (source_ref jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- Creating a document with its source reference
-- ---------------------------------------------------------------------------
--
-- Same channel as `doc_parent_id` (20260811000000): `proposals` has no column
-- for this, and every creation path — the importer, a future re-ingest — should
-- place and stamp a document the same way rather than each growing its own
-- argument.
create or replace function app.docs_apply_source_key()
returns trigger
language plpgsql
set search_path = app, public, pg_temp
as $$
begin
  if new.source_ref is not null or new.frontmatter is null then
    return new;
  end if;

  if new.frontmatter ? 'doc_source_ref' then
    new.source_ref := new.frontmatter -> 'doc_source_ref';

    -- An imported document was not written by a person here, and saying so is
    -- what keeps the AI-activity and provenance surfaces honest.
    if new.origin is null or new.origin = 'human' then
      new.origin := 'system';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists docs_apply_source_key on docs;
create trigger docs_apply_source_key
  before insert on docs
  for each row execute function app.docs_apply_source_key();

commit;
