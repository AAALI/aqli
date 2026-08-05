-- Rollback for 20260805020000_docs_updated_at_explicit.sql
--
-- Restores the unconditional `updated_at := now()`. Note the consequence that
-- migration exists to avoid: after this, no writer reaching the table over
-- PostgREST can make a bulk correction without restamping every row it touches
-- and reordering every document list in the app.

begin;

create or replace function docs_maintain_derived()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.body_text := app.md_to_text(new.body_md);
  new.headings  := app.md_headings(new.body_md);
  new.updated_at := now();
  return new;
end;
$$;

commit;
