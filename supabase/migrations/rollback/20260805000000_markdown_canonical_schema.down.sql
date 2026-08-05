-- Rollback for 20260805000000_markdown_canonical_schema.sql
--
-- Every migration must be reversible up to the step-6 canonical flip. This
-- restores the schema and the trigger-maintained search_vector exactly as they
-- were before step 1. Run it against a database where steps 2 and 3 have not
-- written anything you need to keep — it drops `revisions` and `proposals`.

begin;

-- Restore the original trigger-maintained search_vector -----------------------
drop trigger if exists docs_maintain_derived on docs;
drop function if exists docs_maintain_derived();
drop index if exists docs_search_idx;
alter table docs drop column if exists search_vector;
alter table docs add column search_vector tsvector;

create or replace function docs_update_search_vector()
returns trigger
language plpgsql
as $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body_md, '')), 'B');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

create trigger docs_search_vector_update
  before insert or update on docs
  for each row execute function docs_update_search_vector();

-- Repopulate it for existing rows.
update docs set title = title;

create index docs_search_idx on docs using gin (search_vector);

-- Drop the added indexes ------------------------------------------------------
drop index if exists docs_title_trgm;
drop index if exists docs_ws_class_idx;
drop index if exists docs_space_idx;
drop index if exists docs_current_revision_idx;
drop index if exists api_keys_owner_idx;

-- Drop the new tables ---------------------------------------------------------
alter table docs drop constraint if exists docs_current_revision_id_fkey;
drop table if exists document_links;
drop table if exists proposals cascade;
drop table if exists revisions cascade;

-- Drop the added columns ------------------------------------------------------
alter table docs
  drop column if exists doc_class,
  drop column if exists origin,
  drop column if exists source_ref,
  drop column if exists body_text,
  drop column if exists headings,
  drop column if exists current_revision_id;

alter table api_keys
  drop column if exists owner_user_id,
  drop column if exists scopes;

alter table spaces drop column if exists review_policy;

-- Drop helpers and enums ------------------------------------------------------
drop function if exists app.md_to_text(text);
drop function if exists app.md_headings(text);
drop function if exists app.slugify(text);
drop function if exists app.is_member(uuid);
drop function if exists app.member_role(uuid);
drop schema if exists app cascade;

drop type if exists doc_class;
drop type if exists doc_origin;
drop type if exists review_policy;
drop type if exists proposal_state;
drop type if exists agent_scope;

-- pg_trgm is left installed: harmless, and other work may already depend on it.

commit;
