-- Step 1 of the markdown-canonical migration (spec §2, §9.1).
--
-- Additive only. Nothing in the application reads the new columns or tables
-- yet; after this migration the app must behave exactly as it did before.
--
-- Naming note: the spec calls the current-state table `documents` and the
-- agent credential table `agent_keys`. This repo has shipped them as `docs`
-- and `api_keys` since the first migration, and renaming them is a step-6
-- concern (the canonical flip), not a step-1 one. New tables use the spec's
-- column names (`document_id`) so the eventual rename is mechanical.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- `vector` is deliberately left installed. Dropping it is step 7.
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helper schema
-- ---------------------------------------------------------------------------
create schema if not exists app;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums (spec §2.1)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'doc_class') then
    create type doc_class as enum ('canon', 'record');
  end if;
  if not exists (select 1 from pg_type where typname = 'doc_origin') then
    create type doc_origin as enum ('human', 'agent', 'system');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_policy') then
    create type review_policy as enum ('open', 'review_agents', 'review_all');
  end if;
  if not exists (select 1 from pg_type where typname = 'proposal_state') then
    create type proposal_state as enum ('open', 'merged', 'rejected', 'superseded');
  end if;
  if not exists (select 1 from pg_type where typname = 'agent_scope') then
    create type agent_scope as enum ('read', 'propose', 'write');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS helpers (spec §2.1)
--
-- SECURITY DEFINER so a policy does not re-run the `members` join for every
-- candidate row. `auth.uid()` is wrapped in a select at every call site so the
-- planner hoists it into an InitPlan.
-- ---------------------------------------------------------------------------
create or replace function app.is_member(ws uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from members
    where workspace_id = ws and user_id = (select auth.uid())
  );
$$;

create or replace function app.member_role(ws uuid)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select role from members
  where workspace_id = ws and user_id = (select auth.uid());
$$;

revoke all on function app.is_member(uuid) from public;
revoke all on function app.member_role(uuid) from public;
grant execute on function app.is_member(uuid) to authenticated, service_role;
grant execute on function app.member_role(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Markdown text helpers (spec §3.2)
--
-- Deliberately simple regex functions. They live in the database so that
-- `search_vector` stays correct no matter which path wrote the row — the
-- editor today, the merge engine from step 4 on.
-- ---------------------------------------------------------------------------
create or replace function app.md_to_text(md text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  t text := coalesce(md, '');
begin
  t := regexp_replace(t, '```.*?```', ' ', 'g');                 -- fenced code
  t := regexp_replace(t, '~~~.*?~~~', ' ', 'g');                 -- fenced code (tilde)
  t := regexp_replace(t, '`([^`]*)`', '\1', 'g');                -- inline code
  t := regexp_replace(t, '!\[([^\]]*)\]\([^)]*\)', '\1', 'g');   -- image -> alt
  t := regexp_replace(t, '\[([^\]]*)\]\([^)]*\)', '\1', 'g');    -- link -> text
  t := regexp_replace(t, '^[ \t]*#{1,6}[ \t]+', '', 'gn');       -- heading markers
  t := regexp_replace(t, '^[ \t]*>[ \t]?', '', 'gn');            -- blockquote markers
  t := regexp_replace(t, '^[ \t]*([-*+]|[0-9]+\.)[ \t]+', '', 'gn'); -- list markers
  t := regexp_replace(t, '^[ \t]*(-[ \t]*){3,}$', ' ', 'gn');    -- thematic break
  t := regexp_replace(t, '[*_~]{1,3}', '', 'g');                 -- emphasis markers
  t := regexp_replace(t, '<[^>]*>', ' ', 'g');                   -- stray html
  t := regexp_replace(t, '\s+', ' ', 'g');
  return btrim(t);
end;
$$;

create or replace function app.md_headings(md text)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(
    string_agg(btrim(regexp_replace(m[1], '[#*_`~\[\]()]', '', 'g')), ' '),
    ''
  )
  -- Fences are stripped first so a `# comment` inside a code block is not
  -- mistaken for a heading and weighted B.
  from regexp_matches(
    regexp_replace(coalesce(md, ''), '```.*?```', ' ', 'g'),
    '^[ \t]{0,3}#{1,6}[ \t]+(.+)$',
    'gn'
  ) as m;
$$;

-- Used by the step-4 merge engine when a proposal creates a new document.
create or replace function app.slugify(txt text)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g'),
          '(^-+|-+$)', '', 'g'
        ),
        '-'
      ),
      ''
    ),
    'untitled'
  );
$$;

grant execute on function app.md_to_text(text) to authenticated, service_role;
grant execute on function app.md_headings(text) to authenticated, service_role;
grant execute on function app.slugify(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- spaces.review_policy (spec §2.2)
-- ---------------------------------------------------------------------------
alter table spaces
  add column if not exists review_policy review_policy not null default 'review_agents';

-- ---------------------------------------------------------------------------
-- New columns on docs (spec §2.2)
-- ---------------------------------------------------------------------------
alter table docs
  add column if not exists doc_class           doc_class  not null default 'canon',
  add column if not exists origin              doc_origin not null default 'human',
  add column if not exists source_ref          jsonb,
  add column if not exists body_text           text not null default '',
  add column if not exists headings            text not null default '',
  add column if not exists current_revision_id uuid;

-- The existing `docs_search_vector_update` trigger sets `updated_at := now()`
-- on every write. The backfills below are not user edits, and the doc list is
-- ordered by `updated_at desc` — letting the trigger fire would silently
-- reshuffle every list in the app. Suspend it for the duration.
do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'docs_search_vector_update' and not tgisinternal
  ) then
    alter table docs disable trigger docs_search_vector_update;
  end if;
end $$;

-- `origin` supersedes the existing `author_type` text column. Seed it from
-- there so the two agree from the moment the column exists; `author_type`
-- stays authoritative until the step-6 flip.
update docs set origin = 'agent'::doc_origin
where author_type = 'agent' and origin <> 'agent'::doc_origin;

-- Populate the new derived columns from the markdown we already have, so the
-- weighted search_vector below is correct the instant it is created.
update docs
set body_text = app.md_to_text(body_md),
    headings  = app.md_headings(body_md);

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'docs_search_vector_update' and not tgisinternal
  ) then
    alter table docs enable trigger docs_search_vector_update;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- revisions (spec §2.2)
-- ---------------------------------------------------------------------------
create table if not exists revisions (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid not null references docs(id) on delete cascade,
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  seq                int  not null,
  title              text not null,
  body_md            text not null,
  frontmatter        jsonb not null default '{}'::jsonb,
  author_id          uuid references auth.users(id),
  assisted_by        text[] not null default '{}',
  agent_key_id       uuid references api_keys(id),
  parent_revision_id uuid references revisions(id),
  proposal_id        uuid,
  created_at         timestamptz not null default now(),
  unique (document_id, seq)
);

create index if not exists revisions_workspace_idx on revisions (workspace_id);
create index if not exists revisions_document_idx  on revisions (document_id, seq desc);
create index if not exists revisions_parent_idx    on revisions (parent_revision_id);

-- ---------------------------------------------------------------------------
-- proposals (spec §2.2)
-- ---------------------------------------------------------------------------
create table if not exists proposals (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  space_id         uuid not null references spaces(id),
  document_id      uuid references docs(id) on delete cascade,   -- null = new doc
  base_revision_id uuid references revisions(id),
  title            text not null,
  body_md          text not null,
  frontmatter      jsonb not null default '{}'::jsonb,
  rationale        text,
  author_id        uuid references auth.users(id),
  assisted_by      text[] not null default '{}',
  agent_key_id     uuid references api_keys(id),
  state            proposal_state not null default 'open',
  auto_merged      boolean not null default false,
  review_note      text,
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  idempotency_key  text,
  created_at       timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists proposals_open_idx on proposals (workspace_id, state, created_at desc)
  where state = 'open';
create index if not exists proposals_workspace_idx on proposals (workspace_id);
create index if not exists proposals_document_idx  on proposals (document_id);
create index if not exists proposals_author_idx    on proposals (author_id);

-- `revisions.proposal_id` closes the loop now that proposals exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'revisions_proposal_id_fkey'
  ) then
    alter table revisions
      add constraint revisions_proposal_id_fkey
      foreign key (proposal_id) references proposals(id) on delete set null;
  end if;
end $$;

create index if not exists revisions_proposal_idx on revisions (proposal_id);

-- ---------------------------------------------------------------------------
-- docs.current_revision_id FK (deferred until revisions existed)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'docs_current_revision_id_fkey'
  ) then
    alter table docs
      add constraint docs_current_revision_id_fkey
      foreign key (current_revision_id) references revisions(id) on delete set null;
  end if;
end $$;

create index if not exists docs_current_revision_idx on docs (current_revision_id);

-- ---------------------------------------------------------------------------
-- document_links (spec §2.2)
-- ---------------------------------------------------------------------------
create table if not exists document_links (
  from_document_id uuid not null references docs(id) on delete cascade,
  to_document_id   uuid not null references docs(id) on delete cascade,
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  kind             text not null,   -- 'mentions' | 'touches' | 'supersedes'
  created_at       timestamptz not null default now(),
  primary key (from_document_id, to_document_id, kind)
);

create index if not exists document_links_to_idx        on document_links (to_document_id);
create index if not exists document_links_workspace_idx on document_links (workspace_id);

-- ---------------------------------------------------------------------------
-- api_keys: accountable owner + scopes (spec §2.2)
-- ---------------------------------------------------------------------------
alter table api_keys
  add column if not exists owner_user_id uuid references auth.users(id),
  add column if not exists scopes        agent_scope[] not null default '{read,propose}';

-- Every agent key must belong to a person. Prefer whoever created the key;
-- fall back to the workspace's first admin by join date.
update api_keys k
set owner_user_id = coalesce(
  k.created_by,
  (
    select m.user_id from members m
    where m.workspace_id = k.workspace_id and m.role = 'admin'
    order by m.created_at asc
    limit 1
  )
)
where k.owner_user_id is null;

-- Only enforce NOT NULL if the backfill fully succeeded; a workspace with no
-- admin would otherwise fail the migration on a production copy.
do $$
begin
  if not exists (select 1 from api_keys where owner_user_id is null) then
    alter table api_keys alter column owner_user_id set not null;
  else
    raise warning 'api_keys.owner_user_id left nullable: % rows could not be backfilled',
      (select count(*) from api_keys where owner_user_id is null);
  end if;
end $$;

create index if not exists api_keys_owner_idx on api_keys (owner_user_id);

-- ---------------------------------------------------------------------------
-- Weighted search_vector (spec §2.2)
--
-- Replaces the trigger-maintained title(A)+body_md(B) vector with a generated
-- title(A)+headings(B)+body_text(C) one. The inputs were backfilled above, so
-- search is never empty at any point during this migration. Matching behaviour
-- is equivalent — `searchDocs` uses `@@` and does not rank — except that
-- markdown punctuation is no longer indexed as content.
-- ---------------------------------------------------------------------------
drop trigger if exists docs_search_vector_update on docs;
drop function if exists docs_update_search_vector();
drop index if exists docs_search_idx;

alter table docs drop column if exists search_vector;

alter table docs
  add column search_vector tsvector generated always as (
       setweight(to_tsvector('english', coalesce(title, '')),     'A')
    || setweight(to_tsvector('english', coalesce(headings, '')),  'B')
    || setweight(to_tsvector('english', coalesce(body_text, '')), 'C')
  ) stored;

create index docs_search_idx on docs using gin (search_vector);

-- The dropped trigger also maintained `updated_at` and is the only thing that
-- did. Re-create that behaviour, and keep body_text/headings derived from
-- body_md on every write so the generated vector stays correct regardless of
-- which code path wrote the row.
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

create trigger docs_maintain_derived
  before insert or update on docs
  for each row execute function docs_maintain_derived();

-- ---------------------------------------------------------------------------
-- Supporting indexes (spec §2.2)
-- ---------------------------------------------------------------------------
create index if not exists docs_title_trgm on docs using gin (title extensions.gin_trgm_ops);
create index if not exists docs_ws_class_idx on docs (workspace_id, doc_class);
create index if not exists docs_space_idx on docs (space_id);

-- ---------------------------------------------------------------------------
-- RLS on the new tables (spec §2.3)
--
-- Note what is deliberately absent: the `documents_no_direct_write` policy.
-- Editors still write `docs` directly today; locking that down is step 4/6,
-- and doing it here would break the editor.
-- ---------------------------------------------------------------------------
alter table revisions      enable row level security;
alter table proposals      enable row level security;
alter table document_links enable row level security;

-- revisions: members read. Nothing inserts directly — writes go through the
-- step-4 merge function, and the step-3 backfill runs as the service role.
drop policy if exists revisions_read on revisions;
create policy revisions_read on revisions
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

drop policy if exists proposals_read on proposals;
create policy proposals_read on proposals
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

drop policy if exists proposals_insert on proposals;
create policy proposals_insert on proposals
  for insert to authenticated
  with check (
    (select app.is_member(workspace_id))
    and author_id = (select auth.uid())
  );

-- Only the author may edit an open proposal. Reviewers act through the
-- merge/reject functions, never by updating the row.
drop policy if exists proposals_update_own on proposals;
create policy proposals_update_own on proposals
  for update to authenticated
  using ( author_id = (select auth.uid()) and state = 'open' )
  with check ( author_id = (select auth.uid()) and state = 'open' );

drop policy if exists document_links_read on document_links;
create policy document_links_read on document_links
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

comment on table revisions is
  'Append-only history. One row per merged change. Writes go through app.merge_proposal (step 4).';
comment on table proposals is
  'The universal write path. Humans, agents and the PR ingester all land here first.';
comment on table document_links is
  'Backlinks, primarily record -> canon with kind = touches. Feeds the staleness signal.';
comment on column docs.doc_class is
  'canon = living document, record = immutable event. The retrieval boundary (Decision 4).';
comment on column docs.body_text is
  'body_md with markdown syntax stripped. Search input only — never rendered.';
comment on column docs.headings is
  'Heading text only, weighted B in search_vector so a heading match beats a body match.';
