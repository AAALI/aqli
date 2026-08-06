-- Rollback for the step-6 canonical flip.
--
-- This restores the *schema*, not the data. Once the application has been
-- writing markdown-first, `body_json` is a cache that may lag or be absent,
-- and no migration can reconstruct what was only ever in the markdown. Rolling
-- back means also redeploying the application code from before step 6, and
-- accepting that any document edited in between reverts to its last
-- JSON-canonical state.

begin;

alter table docs
  alter column body_md drop not null,
  alter column body_md drop default;

comment on column docs.body_md is null;
comment on column docs.body_json is null;
comment on table doc_versions is null;

commit;
