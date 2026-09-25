-- Archive pages, and keep an audit log that outlives what it records.
--
-- 1. Archiving. A published page can be put away without being destroyed.
--    `status = 'archived'` already existed in the type and every list already
--    filtered it out; nothing could set it. `archived_at` / `archived_by` say
--    when and who, and `status_before_archive` is what a restore goes back to,
--    so a page waiting on a check is still waiting on it when it comes back.
--    `set_doc_archived` archives a page with everything under it, and restores
--    what was archived together — one action in, one action out.
--
-- 2. The audit log. `doc_activity` is a per-document feed and it cascades
--    with the document: delete a page and the record of who deleted it goes
--    with it. `audit_events` has no foreign key to anything but the workspace,
--    carries a snapshot of what it is about (title, space), and is
--    append-only: no policy lets a client write it, and a trigger refuses
--    update and delete from everyone, the service role included — except the
--    cascade when the workspace itself is deleted.
--
--    Readable by workspace admins only. Existing `doc_activity` rows are
--    copied in once so the log starts with the history already recorded.

-- ---------------------------------------------------------------------------
-- 1. Archiving
-- ---------------------------------------------------------------------------

alter table docs add column if not exists archived_at timestamptz;
alter table docs add column if not exists archived_by uuid references auth.users(id) on delete set null;
alter table docs add column if not exists status_before_archive text;

create index if not exists docs_archived_idx
  on docs (workspace_id, archived_at desc)
  where archived_at is not null;

-- SECURITY INVOKER: the caller's RLS decides which of the documents they may
-- touch, exactly as with move_doc. Returns the ids it changed.
create or replace function public.set_doc_archived(p_doc_id uuid, p_archived boolean)
returns uuid[]
language plpgsql
set search_path = public, app, pg_temp
as $$
declare
  target  docs%rowtype;
  ids     uuid[];
  stamps  jsonb;
  now_ts  timestamptz := clock_timestamp();
begin
  select * into target from docs where id = p_doc_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'document not found';
  end if;

  if p_archived then
    if target.status = 'draft' then
      raise exception using errcode = '22023',
        message = 'a draft is discarded, not archived';
    end if;
    if target.status = 'archived' then
      return array[]::uuid[];
    end if;

    -- The page and everything under it that is still live. A sub-page left
    -- behind would surface at the top of the space with no parent.
    with recursive sub as (
      select d.id, 0 as depth from docs d where d.id = p_doc_id
      union all
      select d.id, sub.depth + 1
      from docs d join sub on d.parent_doc_id = sub.id
      where sub.depth < 64
    )
    select array_agg(d.id) into ids
    from docs d join sub on sub.id = d.id
    where d.status <> 'archived';
  else
    if target.status <> 'archived' then
      return array[]::uuid[];
    end if;

    -- What was archived in the same action: the page and the descendants that
    -- carry its archived_at. Something archived on its own, earlier, stays put.
    with recursive sub as (
      select d.id, 0 as depth from docs d where d.id = p_doc_id
      union all
      select d.id, sub.depth + 1
      from docs d join sub on d.parent_doc_id = sub.id
      where sub.depth < 64
    )
    select array_agg(d.id) into ids
    from docs d join sub on sub.id = d.id
    where d.status = 'archived'
      and (d.id = p_doc_id or d.archived_at is not distinct from target.archived_at);
  end if;

  if ids is null then
    return array[]::uuid[];
  end if;

  -- Archiving is not an edit: put `updated_at` back afterwards, the same way
  -- move_doc does, so the page does not float to the top of every list.
  select jsonb_object_agg(id::text, to_jsonb(updated_at)) into stamps
  from docs where id = any (ids);

  if p_archived then
    update docs
       set status_before_archive = status,
           status = 'archived',
           archived_at = now_ts,
           archived_by = auth.uid()
     where id = any (ids);
  else
    update docs
       set status = coalesce(nullif(status_before_archive, 'archived'), 'approved'),
           status_before_archive = null,
           archived_at = null,
           archived_by = null
     where id = any (ids);

    -- Coming back under a parent that is still archived would hide it. It
    -- comes back at the top of its space instead.
    update docs d
       set parent_doc_id = null
     where d.id = p_doc_id
       and exists (select 1 from docs p where p.id = d.parent_doc_id and p.status = 'archived');
  end if;

  update docs d
     set updated_at = (stamps ->> d.id::text)::timestamptz
   where d.id = any (ids);

  return ids;
end $$;

comment on function public.set_doc_archived(uuid, boolean) is
  'Archive a published page with its sub-pages, or restore what was archived with it. Runs as the caller.';

revoke all on function public.set_doc_archived(uuid, boolean) from public, anon;
grant execute on function public.set_doc_archived(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. The audit log
-- ---------------------------------------------------------------------------

create table if not exists audit_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  occurred_at   timestamptz not null default now(),
  -- Who. A human is a user id; an agent is the key it used and the person
  -- accountable for that key; a system actor (an importer, a webhook) has a
  -- name and nothing else.
  actor_type    text not null check (actor_type in ('human', 'agent', 'system')),
  actor_id      uuid,
  actor_key_id  uuid,
  actor_name    text,
  -- What. `action` is `<target>.<verb>`: doc.archived, member.removed, key.created.
  action        text not null,
  target_type   text not null,
  target_id     text,
  -- A snapshot, because the thing it names may not exist tomorrow.
  target_label  text,
  doc_id        uuid,
  space_id      uuid,
  metadata      jsonb not null default '{}'::jsonb,
  -- Where from.
  ip            text,
  user_agent    text,
  source        text not null default 'app' check (source in ('app', 'backfill'))
);

create index if not exists audit_events_ws_time_idx on audit_events (workspace_id, occurred_at desc);
create index if not exists audit_events_ws_doc_idx on audit_events (workspace_id, doc_id, occurred_at desc) where doc_id is not null;
create index if not exists audit_events_ws_actor_idx on audit_events (workspace_id, actor_id, occurred_at desc);
create index if not exists audit_events_ws_action_idx on audit_events (workspace_id, action, occurred_at desc);

alter table audit_events enable row level security;

drop policy if exists audit_events_admin_read on audit_events;
create policy audit_events_admin_read on audit_events
  for select to authenticated
  using ( (select app.member_role(workspace_id)) = 'admin' );

-- Written only by the server, on the service role. No client grant beyond read.
revoke insert, update, delete, truncate on audit_events from anon, authenticated;
grant select on audit_events to authenticated;
grant select, insert on audit_events to service_role;

create or replace function app.audit_events_append_only()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- The one delete allowed: the workspace itself is being deleted, and the
  -- cascade is taking its log with it.
  if tg_op = 'DELETE' and not exists (select 1 from workspaces w where w.id = old.workspace_id) then
    return old;
  end if;
  raise exception using
    errcode = '42501',
    message = 'audit_events is append-only';
end $$;

drop trigger if exists audit_events_append_only on audit_events;
create trigger audit_events_append_only
  before update or delete on audit_events
  for each row execute function app.audit_events_append_only();

-- Start from the history already recorded. Once: a re-run finds the
-- backfilled rows and copies nothing.
insert into audit_events (
  workspace_id, occurred_at, actor_type, actor_id, actor_key_id, actor_name,
  action, target_type, target_id, target_label, doc_id, space_id, metadata, source
)
select
  a.workspace_id,
  coalesce(a.created_at, now()),
  case when a.actor_type = 'agent' then 'agent' else 'human' end,
  case when a.actor_type <> 'agent'
        and a.actor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       then a.actor_id::uuid end,
  case when a.actor_type = 'agent'
        and a.actor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       then a.actor_id::uuid end,
  a.actor_name,
  'doc.' || case a.action when 'updated' then 'edited' else a.action end,
  'doc',
  a.doc_id::text,
  d.title,
  a.doc_id,
  d.space_id,
  coalesce(a.metadata, '{}'::jsonb),
  'backfill'
from doc_activity a
left join docs d on d.id = a.doc_id
where a.action <> 'embedded'
  and not exists (select 1 from audit_events e where e.source = 'backfill');
