-- Sub-pages: a document may have a parent (ADOPTION.md F-3).
--
-- Every wiki people are leaving is a tree — Benefits → Leave → Parental leave —
-- and flattening one on the way in makes the migrated content unfindable for
-- exactly the non-technical staff the move is meant to serve. So the importer
-- needs somewhere to put a parent before it runs.
--
-- The tree is metadata, not markdown (C1): nothing here touches `body_md`, the
-- allowlist, or the round trip. A move changes two columns and writes activity;
-- it does not write a revision, because the document did not change.
--
-- Every invariant below is enforced by a trigger rather than by the
-- application. A cycle reachable through the REST API, the agent API, MCP or a
-- half-finished import is the same cycle, and the UI is the one place it is
-- easy to be careful in.

begin;

alter table docs
  -- `on delete set null` is a backstop only: the delete trigger below
  -- re-parents children to their grandparent first, so by the time a row is
  -- removed nothing points at it. Left in place so a database whose triggers
  -- have been disabled orphans a subtree rather than failing the delete.
  add column if not exists parent_doc_id uuid references docs(id) on delete set null,
  add column if not exists position      integer not null default 0;

comment on column docs.parent_doc_id is
  'Parent document, within the same space. The tree is metadata: it never appears in body_md.';
comment on column docs.position is
  'Sort order among siblings. Contiguous from 0 within a parent; app.move_doc renumbers.';

-- Listing a parent''s children is the query the sidebar runs once per expanded
-- node, so it gets the index rather than a sort.
create index if not exists docs_parent_position_idx
  on docs (workspace_id, space_id, parent_doc_id, position);

-- ---------------------------------------------------------------------------
-- Depth
-- ---------------------------------------------------------------------------
--
-- Real corpora rarely exceed five levels; the cap is eight. It exists so that
-- a runaway import cannot build a chain no sidebar can render and no
-- breadcrumb can show.
create or replace function app.doc_depth(p_doc_id uuid)
returns integer
language sql
stable
set search_path = app, public, pg_temp
as $$
  with recursive up as (
    select d.id, d.parent_doc_id, 0 as depth
    from docs d where d.id = p_doc_id
    union all
    select d.id, d.parent_doc_id, up.depth + 1
    from docs d join up on d.id = up.parent_doc_id
    -- Belt and braces: the guard below makes cycles unreachable, but a
    -- recursive term with no bound is a hang rather than an error if one ever
    -- existed.
    where up.depth < 64
  )
  select coalesce(max(depth), 0) from up;
$$;

/** How many levels hang below a document, counting itself as 0. */
create or replace function app.doc_subtree_height(p_doc_id uuid)
returns integer
language sql
stable
set search_path = app, public, pg_temp
as $$
  with recursive down as (
    select d.id, 0 as depth
    from docs d where d.id = p_doc_id
    union all
    select d.id, down.depth + 1
    from docs d join down on d.parent_doc_id = down.id
    where down.depth < 64
  )
  select coalesce(max(depth), 0) from down;
$$;

-- ---------------------------------------------------------------------------
-- The guard
-- ---------------------------------------------------------------------------
create or replace function app.docs_guard_tree()
returns trigger
language plpgsql
set search_path = app, public, pg_temp
as $$
declare
  parent   docs%rowtype;
  ancestor uuid;
  hops     integer := 0;
  depth    integer;
begin
  if new.parent_doc_id is null then
    return new;
  end if;

  if new.parent_doc_id = new.id then
    raise exception using
      errcode = '23514',
      message = 'a document cannot be its own parent';
  end if;

  select * into parent from docs where id = new.parent_doc_id;
  if not found then
    raise exception using errcode = '23503', message = 'parent document does not exist';
  end if;

  if parent.workspace_id <> new.workspace_id then
    raise exception using
      errcode = '23514',
      message = 'a document cannot be parented across workspaces';
  end if;

  -- Same space, so that a subtree is always wholly inside one space. Space
  -- membership is what F-4 will make a privacy boundary, and a child in a
  -- different space from its parent is a hole in it before it exists.
  if parent.space_id is distinct from new.space_id then
    raise exception using
      errcode = '23514',
      message = 'a sub-page must live in the same space as its parent';
  end if;

  -- Walk up from the proposed parent. Reaching this row means the move would
  -- close a loop and strand the whole subtree outside the tree.
  ancestor := parent.parent_doc_id;
  while ancestor is not null loop
    if ancestor = new.id then
      raise exception using
        errcode = '23514',
        message = 'that move would make a document its own ancestor';
    end if;
    hops := hops + 1;
    if hops > 64 then
      raise exception using errcode = '23514', message = 'document hierarchy is unexpectedly deep';
    end if;
    select parent_doc_id into ancestor from docs where id = ancestor;
  end loop;

  -- The subtree travels with the document, so the deepest descendant is what
  -- has to fit under the new parent, not the document itself.
  depth := app.doc_depth(new.parent_doc_id) + 1;
  if tg_op = 'UPDATE' then
    depth := depth + app.doc_subtree_height(new.id);
  end if;

  -- `depth` counts hops from the root, so a document at depth 0 is the first
  -- level. Eight levels means a deepest depth of 7.
  if depth > 7 then
    raise exception using
      errcode = '23514',
      message = format('that move would nest documents %s levels deep; the limit is 8', depth + 1);
  end if;

  return new;
end $$;

drop trigger if exists docs_guard_tree on docs;
create trigger docs_guard_tree
  before insert or update of parent_doc_id, space_id on docs
  for each row execute function app.docs_guard_tree();

-- ---------------------------------------------------------------------------
-- Placing a document at creation
-- ---------------------------------------------------------------------------
--
-- An agent proposal and an importer both create documents through
-- `app.submit_proposal`, which carries what `proposals` has no column for in
-- `frontmatter` under control keys — `doc_type`, `doc_status`, `agent_id`.
-- Placement is the same kind of thing, so `doc_parent_id` joins them rather
-- than every creation path growing its own argument.
--
-- Named to sort before `docs_guard_tree`: both are `before insert` triggers,
-- Postgres fires them in name order, and the guard has to see the parent this
-- one resolves.
create or replace function app.docs_apply_parent_key()
returns trigger
language plpgsql
set search_path = app, public, pg_temp
as $$
declare
  claimed uuid;
begin
  if new.parent_doc_id is not null or new.frontmatter is null then
    return new;
  end if;

  begin
    claimed := nullif(new.frontmatter ->> 'doc_parent_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception using
      errcode = '22P02',
      message = format('doc_parent_id is not a document id: %L', new.frontmatter ->> 'doc_parent_id');
  end;

  if claimed is null then
    return new;
  end if;

  new.parent_doc_id := claimed;

  -- A sub-page belongs to its parent's space. A caller that named a parent but
  -- no space means the obvious thing, and the alternative is the tree guard
  -- refusing a write whose intent was never ambiguous.
  if new.space_id is null then
    select space_id into new.space_id from docs where id = claimed;
  end if;

  return new;
end $$;

drop trigger if exists docs_apply_parent_key on docs;
create trigger docs_apply_parent_key
  before insert on docs
  for each row execute function app.docs_apply_parent_key();

-- ---------------------------------------------------------------------------
-- Deleting a parent never orphans and never cascades
-- ---------------------------------------------------------------------------
--
-- Deleting a page with children is nearly always "this page is redundant", not
-- "delete this section". Cascading would make one click destroy work nobody
-- looked at; orphaning would hide it. Children rise to the grandparent, which
-- is where a reader would look for them next.
create or replace function app.docs_reparent_children()
returns trigger
language plpgsql
set search_path = app, public, pg_temp
as $$
begin
  update docs
     set parent_doc_id = old.parent_doc_id
   where parent_doc_id = old.id;
  return old;
end $$;

drop trigger if exists docs_reparent_children on docs;
create trigger docs_reparent_children
  before delete on docs
  for each row execute function app.docs_reparent_children();

-- ---------------------------------------------------------------------------
-- Where am I?
-- ---------------------------------------------------------------------------
--
-- Breadcrumbs on the doc view and the parent path in search results both want
-- the ancestors of one document, root first. PostgREST cannot express a
-- recursive query, so it gets a function rather than the application walking
-- the tree one round trip at a time.
--
-- SECURITY INVOKER (the default): the select inside runs under the caller's
-- RLS, so a document they cannot read contributes nothing to the path.
create or replace function public.doc_path(p_doc_id uuid)
returns jsonb
language sql
stable
set search_path = public, app, pg_temp
as $$
  with recursive up as (
    select d.id, d.title, d.parent_doc_id, 0 as depth
    from docs d where d.id = p_doc_id
    union all
    select d.id, d.title, d.parent_doc_id, up.depth + 1
    from docs d join up on d.id = up.parent_doc_id
    where up.depth < 64
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('id', id, 'title', title) order by depth desc)
      filter (where depth > 0),
    '[]'::jsonb
  )
  from up;
$$;

comment on function public.doc_path(uuid) is
  'Ancestors of a document, root first, excluding the document itself. Runs as the caller, so RLS decides what is in the path.';

revoke all on function public.doc_path(uuid) from public;
grant execute on function public.doc_path(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Moving
-- ---------------------------------------------------------------------------
--
-- SECURITY INVOKER: the caller's RLS decides whether they may touch either
-- document. This function exists for atomicity and for renumbering siblings,
-- not to get around a policy.
create or replace function public.move_doc(
  p_doc_id    uuid,
  p_parent_id uuid,
  p_position  integer default null
)
returns void
language plpgsql
set search_path = public, app, pg_temp
as $$
declare
  target    docs%rowtype;
  sibling   docs%rowtype;
  ordinal   integer := 0;
  stamps    jsonb;
begin
  select * into target from docs where id = p_doc_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'document not found';
  end if;

  -- A move is not an edit. `updated_at` orders every "recently updated" list in
  -- the app, and `docs_maintain_derived` stamps now() on any write, so dragging
  -- one page in the sidebar would otherwise float it and its new siblings to
  -- the top of every list. Snapshot the timestamps and put them back.
  select jsonb_object_agg(id::text, to_jsonb(updated_at))
    into stamps
    from docs
   where workspace_id = target.workspace_id
     and space_id is not distinct from target.space_id
     and (id = p_doc_id
          or parent_doc_id is not distinct from p_parent_id
          or parent_doc_id is not distinct from target.parent_doc_id);

  update docs set parent_doc_id = p_parent_id where id = p_doc_id;

  -- Renumber the destination so positions stay contiguous whatever the caller
  -- asked for: a client that has been open for a while is working from a stale
  -- list, and an out-of-range index should land at the end rather than fail.
  for sibling in
    select * from docs
    where workspace_id = target.workspace_id
      and space_id is not distinct from target.space_id
      and parent_doc_id is not distinct from p_parent_id
      and id <> p_doc_id
    order by position, updated_at desc
  loop
    if p_position is not null and ordinal = greatest(p_position, 0) then
      ordinal := ordinal + 1;
    end if;
    update docs set position = ordinal where id = sibling.id;
    ordinal := ordinal + 1;
  end loop;

  update docs
     set position = case
       when p_position is null then ordinal
       else least(greatest(p_position, 0), ordinal)
     end
   where id = p_doc_id;

  -- Second step, deliberately: the trigger only honours an `updated_at` that
  -- differs from the stored one, and the writes above have just stamped now().
  update docs d
     set updated_at = (stamps ->> d.id::text)::timestamptz
    from jsonb_each(stamps) as s(key, value)
   where d.id = s.key::uuid
     and d.updated_at is distinct from (stamps ->> d.id::text)::timestamptz;
end $$;

comment on function public.move_doc(uuid, uuid, integer) is
  'Re-parent and reorder a document. Runs as the caller, so RLS decides; the tree guard decides the rest.';

revoke all on function public.move_doc(uuid, uuid, integer) from public;
grant execute on function public.move_doc(uuid, uuid, integer) to authenticated, service_role;

commit;
