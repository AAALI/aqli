-- Import idempotency (20260812000000).
--
-- The importer promises that a second run updates rather than duplicates. This
-- is the half of that promise the database keeps: if the importer's own lookup
-- is ever wrong, the second insert fails instead of quietly succeeding.

begin;

set client_min_messages = warning;

do $$
declare
  ws    uuid;
  other uuid;
  sp    uuid;
  first uuid;
  caught boolean := false;
begin
  insert into workspaces (name, slug) values ('Importing', 'importing-test') returning id into ws;
  insert into workspaces (name, slug) values ('Elsewhere', 'elsewhere-test') returning id into other;
  insert into spaces (workspace_id, name, slug) values (ws, 'Handbook', 'handbook') returning id into sp;

  -- The control key stamps the reference and marks the document as machine-written.
  insert into docs (workspace_id, space_id, title, body_md, frontmatter)
  values (ws, sp, 'Parental leave', 'Six weeks.',
          jsonb_build_object('doc_source_ref', jsonb_build_object('source', 'confluence', 'id', '12345')))
  returning id into first;

  assert (select source_ref ->> 'id' from docs where id = first) = '12345',
    'doc_source_ref should stamp source_ref';
  assert (select origin from docs where id = first) = 'system',
    'an imported document was not written by a person here';

  -- The same page, imported again.
  begin
    insert into docs (workspace_id, space_id, title, body_md, frontmatter)
    values (ws, sp, 'Parental leave', 'Six weeks.',
            jsonb_build_object('doc_source_ref', jsonb_build_object('source', 'confluence', 'id', '12345')));
  exception when unique_violation then caught := true;
  end;
  assert caught, 're-importing the same source page must not create a second document';

  -- A different page from the same export is fine...
  insert into docs (workspace_id, space_id, title, body_md, frontmatter)
  values (ws, sp, 'Sick leave', 'Body',
          jsonb_build_object('doc_source_ref', jsonb_build_object('source', 'confluence', 'id', '999')));

  -- ...as is the same page id from a different source...
  insert into docs (workspace_id, space_id, title, body_md, frontmatter)
  values (ws, sp, 'Coincidence', 'Body',
          jsonb_build_object('doc_source_ref', jsonb_build_object('source', 'notion', 'id', '12345')));

  -- ...and the same export imported into another workspace, which is a
  -- different company's copy and none of this one's business.
  insert into docs (workspace_id, title, body_md, frontmatter)
  values (other, 'Parental leave', 'Six weeks.',
          jsonb_build_object('doc_source_ref', jsonb_build_object('source', 'confluence', 'id', '12345')));

  -- Documents written by people carry no source reference, and any number of
  -- them can exist.
  insert into docs (workspace_id, space_id, title, body_md) values (ws, sp, 'Hand-written', 'a');
  insert into docs (workspace_id, space_id, title, body_md) values (ws, sp, 'Also hand-written', 'b');
  assert (select count(*) from docs where workspace_id = ws and source_ref is null) = 2,
    'the uniqueness rule must not apply to documents that have no source reference';
end $$;

rollback;
