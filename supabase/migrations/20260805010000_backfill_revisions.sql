-- Step 3: backfill `revisions` from `doc_versions` (brief step 3, spec §9.3).
--
-- Behaviour-neutral. Nothing reads `revisions` yet; this exists so the merge
-- engine in step 4 has history to chain onto.
--
-- The mapping was checked against the real data before this was written, since
-- an ambiguous one is a stop-and-report signal rather than something to guess
-- at. On the production database: 100 versions across 75 documents, no orphan
-- rows, no null bodies, no duplicate version numbers per document, no gaps, no
-- tied timestamps, and ordering by `version_number` agrees with ordering by
-- `created_at` on every one of the 100 rows. So `version_number` is a faithful
-- chronological sequence and becomes `seq` directly.
--
-- Two honest gaps, both recorded rather than papered over:
--
--   * `doc_versions` has no title column, so `revisions.title` — which is NOT
--     NULL — takes the document's current title. Historical titles were never
--     stored and cannot be recovered.
--   * 88 of 100 versions have a null `changed_by`. `author_id` is nullable and
--     stays null for those; inventing an author would be worse than admitting
--     the row is unattributed.
--
-- Documents with no version history keep `current_revision_id = null`. There
-- are 8 of them. Synthesising a revision for those would be fabricating history
-- that never happened, and the step-4 merge engine treats a null base as "no
-- prior revision" already.

begin;

-- ---------------------------------------------------------------------------
-- Pass 1 — one revision per version, seq from version_number
-- ---------------------------------------------------------------------------
insert into revisions (
  document_id, workspace_id, seq, title, body_md, frontmatter,
  author_id, assisted_by, agent_key_id, parent_revision_id, proposal_id, created_at
)
select
  v.doc_id,
  d.workspace_id,
  v.version_number,
  d.title,                                  -- see note above
  v.body_md,
  coalesce(v.frontmatter, '{}'::jsonb),
  v.changed_by,
  '{}'::text[],                             -- assisted_by: empty for historical rows
  null,                                     -- agent_key_id: unknowable retrospectively
  null,                                     -- parent_revision_id: chained in pass 2
  null,                                     -- proposal_id: these predate proposals
  v.created_at
from doc_versions v
join docs d on d.id = v.doc_id
where not exists (
  select 1 from revisions r
  where r.document_id = v.doc_id and r.seq = v.version_number
);

-- ---------------------------------------------------------------------------
-- Pass 2 — chain each revision to its predecessor
-- ---------------------------------------------------------------------------
update revisions r
set parent_revision_id = prev.id
from (
  select id,
         document_id,
         seq,
         lag(id) over (partition by document_id order by seq) as prev_id
  from revisions
) ordered
join revisions prev on prev.id = ordered.prev_id
where r.id = ordered.id
  and r.parent_revision_id is distinct from prev.id;

-- ---------------------------------------------------------------------------
-- Pass 3 — point each document at its latest revision
--
-- The `docs_maintain_derived` trigger sets `updated_at := now()` on every
-- write. This is a backfill, not an edit, and the document list is ordered by
-- `updated_at desc` — letting it fire would reshuffle every list in the app,
-- which is exactly the user-visible change this step must not make.
-- ---------------------------------------------------------------------------
alter table docs disable trigger docs_maintain_derived;

update docs d
set current_revision_id = latest.id
from (
  select distinct on (document_id) document_id, id
  from revisions
  order by document_id, seq desc
) latest
where d.id = latest.document_id
  and d.current_revision_id is distinct from latest.id;

alter table docs enable trigger docs_maintain_derived;

commit;
