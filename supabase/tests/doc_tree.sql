-- Sub-pages (20260811000000).
--
-- The point of putting these rules in triggers is that the REST API, the agent
-- API, MCP and an importer all reach the same table. So the assertions here go
-- through plain SQL, the way a client that forgot to check would.

begin;

set client_min_messages = warning;

do $$
declare
  ws       uuid;
  sp       uuid;
  other_sp uuid;
  a uuid; b uuid; c uuid; d uuid;
  caught   boolean;
  chain    uuid;
  parent   uuid;
begin
  insert into workspaces (name, slug) values ('Tree', 'tree-test') returning id into ws;
  insert into spaces (workspace_id, name, slug) values (ws, 'Handbook', 'handbook') returning id into sp;
  insert into spaces (workspace_id, name, slug) values (ws, 'Finance', 'finance') returning id into other_sp;

  insert into docs (workspace_id, space_id, title, body_md) values (ws, sp, 'Benefits', '') returning id into a;
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id) values (ws, sp, 'Leave', '', a) returning id into b;
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id) values (ws, sp, 'Parental leave', '', b) returning id into c;

  -- --- a three-level chain reads back in order ------------------------------
  assert app.doc_depth(c) = 2, format('expected depth 2, got %s', app.doc_depth(c));
  assert app.doc_subtree_height(a) = 2, format('expected height 2, got %s', app.doc_subtree_height(a));

  -- --- a document cannot be its own parent ----------------------------------
  caught := false;
  begin
    update docs set parent_doc_id = a where id = a;
  exception when check_violation then caught := true;
  end;
  assert caught, 'a document must not be able to parent itself';

  -- --- nor its own ancestor -------------------------------------------------
  --
  -- The move that looks innocent from the UI: drag the top of a section into
  -- something further down it, and the whole section leaves the tree.
  caught := false;
  begin
    update docs set parent_doc_id = c where id = a;
  exception when check_violation then caught := true;
  end;
  assert caught, 'a move that closes a loop must be refused by the database';

  -- --- and the tree survived the attempt ------------------------------------
  assert (select parent_doc_id from docs where id = a) is null,
    'a refused move must leave the document where it was';

  -- --- a sub-page stays in its parent''s space -------------------------------
  caught := false;
  begin
    insert into docs (workspace_id, space_id, title, body_md, parent_doc_id)
    values (ws, other_sp, 'Salaries', '', a);
  exception when check_violation then caught := true;
  end;
  assert caught, 'a sub-page in a different space from its parent must be refused';

  -- --- the depth cap --------------------------------------------------------
  parent := c;  -- already at depth 2
  for i in 3..7 loop
    insert into docs (workspace_id, space_id, title, body_md, parent_doc_id)
    values (ws, sp, format('Level %s', i), '', parent)
    returning id into chain;
    parent := chain;
  end loop;
  assert app.doc_depth(parent) = 7, format('expected depth 7, got %s', app.doc_depth(parent));

  caught := false;
  begin
    insert into docs (workspace_id, space_id, title, body_md, parent_doc_id)
    values (ws, sp, 'Level 8', '', parent);
  exception when check_violation then caught := true;
  end;
  assert caught, 'nesting past the cap must be refused';

  -- --- deleting a parent re-parents, never orphans or cascades --------------
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id) values (ws, sp, 'Sick leave', '', b)
    returning id into d;

  delete from docs where id = b;

  assert exists (select 1 from docs where id = c), 'deleting a parent must not cascade to its children';
  assert (select parent_doc_id from docs where id = c) = a,
    'a deleted parent''s children must rise to the grandparent';
  assert (select parent_doc_id from docs where id = d) = a,
    'every child rises, not just the first';

  -- A root document''s children become roots rather than being orphaned into
  -- a space nobody can navigate to.
  delete from docs where id = a;
  assert (select parent_doc_id from docs where id = c) is null,
    'children of a deleted root must become roots';
end $$;

-- ---------------------------------------------------------------------------
-- doc_parent_id: how a proposal or an importer places a new page
-- ---------------------------------------------------------------------------
do $$
declare
  ws uuid; sp uuid; parent uuid; child uuid; caught boolean := false;
begin
  insert into workspaces (name, slug) values ('Placing', 'placing-test') returning id into ws;
  insert into spaces (workspace_id, name, slug) values (ws, 'Handbook', 'handbook') returning id into sp;
  insert into docs (workspace_id, space_id, title, body_md) values (ws, sp, 'Benefits', '') returning id into parent;

  -- The control key places the document, and the space comes from the parent:
  -- a caller that named a parent and no space meant the obvious thing.
  insert into docs (workspace_id, title, body_md, frontmatter)
  values (ws, 'Leave', '', jsonb_build_object('doc_parent_id', parent::text))
  returning id into child;

  assert (select parent_doc_id from docs where id = child) = parent,
    'doc_parent_id in frontmatter should place the document';
  assert (select space_id from docs where id = child) = sp,
    'a sub-page with no space of its own should inherit its parent''s';

  -- Rubbish in the control key is refused rather than silently dropped: a
  -- placement that quietly does not happen is how an import loses its tree.
  begin
    insert into docs (workspace_id, space_id, title, body_md, frontmatter)
    values (ws, sp, 'Nowhere', '', jsonb_build_object('doc_parent_id', 'not-a-uuid'));
  exception when invalid_text_representation then caught := true;
  end;
  assert caught, 'an unparseable doc_parent_id must be refused';

  -- An explicit parent_doc_id wins over the control key, so a direct writer is
  -- never second-guessed.
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id, frontmatter)
  values (ws, sp, 'Explicit', '', null, jsonb_build_object('doc_parent_id', parent::text))
  returning id into child;
  assert (select parent_doc_id from docs where id = child) = parent,
    'the control key applies when parent_doc_id was not given';
end $$;

-- ---------------------------------------------------------------------------
-- doc_path: what the breadcrumb reads
-- ---------------------------------------------------------------------------
do $$
declare
  ws uuid; sp uuid; a uuid; b uuid; c uuid; path jsonb;
begin
  insert into workspaces (name, slug) values ('Path', 'path-test') returning id into ws;
  insert into spaces (workspace_id, name, slug) values (ws, 'Handbook', 'handbook') returning id into sp;
  insert into docs (workspace_id, space_id, title, body_md) values (ws, sp, 'Benefits', '') returning id into a;
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id) values (ws, sp, 'Leave', '', a) returning id into b;
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id) values (ws, sp, 'Parental leave', '', b) returning id into c;

  path := public.doc_path(c);
  assert jsonb_array_length(path) = 2, format('expected two ancestors, got %s', path);
  assert path -> 0 ->> 'title' = 'Benefits', 'the path must start at the root';
  assert path -> 1 ->> 'title' = 'Leave', 'the path must end at the immediate parent';

  -- A root document has no ancestors, and the caller gets an empty list rather
  -- than null to render.
  assert public.doc_path(a) = '[]'::jsonb, 'a root document has an empty path';
end $$;

-- ---------------------------------------------------------------------------
-- move_doc: ordering, and what a move is not
-- ---------------------------------------------------------------------------
do $$
declare
  ws uuid; sp uuid;
  one uuid; two uuid; three uuid; home uuid;
  stamp timestamptz;
begin
  insert into workspaces (name, slug) values ('Ordering', 'ordering-test') returning id into ws;
  insert into spaces (workspace_id, name, slug) values (ws, 'Ops', 'ops') returning id into sp;

  insert into docs (workspace_id, space_id, title, body_md) values (ws, sp, 'Home', '') returning id into home;
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id) values (ws, sp, 'One', '', home) returning id into one;
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id) values (ws, sp, 'Two', '', home) returning id into two;
  insert into docs (workspace_id, space_id, title, body_md, parent_doc_id) values (ws, sp, 'Three', '', home) returning id into three;

  perform public.move_doc(one, home, 0);
  perform public.move_doc(two, home, 1);
  perform public.move_doc(three, home, 2);
  assert (select array_agg(title order by position) from docs where parent_doc_id = home)
         = array['One', 'Two', 'Three'], 'positions should follow the order they were set in';

  -- Drag the last one to the front.
  perform public.move_doc(three, home, 0);
  assert (select array_agg(title order by position) from docs where parent_doc_id = home)
         = array['Three', 'One', 'Two'], 'a reorder should renumber siblings contiguously';

  -- Positions stay contiguous from zero, so a stale client cannot open gaps.
  assert (select array_agg(position order by position) from docs where parent_doc_id = home)
         = array[0, 1, 2], 'positions must stay contiguous';

  -- An out-of-range index lands at the end rather than failing: the client
  -- that sent it has simply been open a while.
  perform public.move_doc(three, home, 99);
  assert (select title from docs where parent_doc_id = home order by position desc limit 1) = 'Three',
    'an out-of-range position should land at the end';

  -- --- a move is not an edit ------------------------------------------------
  select updated_at into stamp from docs where id = two;
  perform pg_sleep(0.01);
  perform public.move_doc(two, null, 0);
  assert (select updated_at from docs where id = two) = stamp,
    'moving a document must not restamp updated_at, which orders every list in the app';
  assert (select parent_doc_id from docs where id = two) is null, 'the move should still have happened';
end $$;

rollback;
