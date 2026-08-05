-- Step 1 of the markdown-canonical migration (spec §2, §9.1).
-- Strictly additive: nothing in the app reads or writes any of this yet.
-- body_json remains canonical; the existing search_vector trigger is untouched.
--
-- Naming note (deliberate deviation from spec §2, documented in the PR):
-- the live schema uses `docs`, `doc_versions` and `api_keys` where the spec's
-- end-state uses `documents`, `revisions` and `agent_keys`. This migration is
-- additive on the EXISTING tables (docs, api_keys) and creates the NEW tables
-- under their spec names (revisions, proposals, document_links). Renames, the
-- `documents_no_direct_write` policy, and dropping the old search trigger all
-- belong to the step-6 flip, which is out of scope here.

-- ---------------------------------------------------------------------------
-- Extensions. pg_trgm for typo-tolerant title search (spec §5.2).
-- `vector` is deliberately NOT dropped — that is step 7.
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (spec §2.1)
-- ---------------------------------------------------------------------------
create type public.doc_class      as enum ('canon', 'record');
create type public.doc_origin     as enum ('human', 'agent', 'system');
create type public.review_policy  as enum ('open', 'review_agents', 'review_all');
create type public.proposal_state as enum ('open', 'merged', 'rejected', 'superseded');
create type public.agent_scope    as enum ('read', 'propose', 'write');

-- ---------------------------------------------------------------------------
-- app schema + SECURITY DEFINER helpers (spec §2.1). These exist so policies
-- don't re-run the members join under RLS (measured 178,000ms → 12ms).
-- ---------------------------------------------------------------------------
create schema if not exists app;
grant usage on schema app to authenticated, service_role;

create or replace function app.is_member(ws uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from members
    where workspace_id = ws and user_id = (select auth.uid())
  );
$$;

create or replace function app.member_role(ws uuid)
returns text language sql security definer stable
set search_path = public, pg_temp as $$
  select role from members
  where workspace_id = ws and user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- spaces.review_policy (spec §2.2)
-- ---------------------------------------------------------------------------
alter table public.spaces
  add column review_policy public.review_policy not null default 'review_agents';

-- ---------------------------------------------------------------------------
-- New columns on docs (the spec's `documents`).
--
-- search_vector_v2: the spec's generated A/B/C-weighted vector. The existing
-- trigger-maintained `search_vector` (title A + body_md B) is what the app
-- reads today and stays untouched; at the step-6 flip the old column and
-- trigger are dropped and this one is renamed. body_text / headings are ''
-- until the step-2 backfill, so the new vector is title-only until then —
-- fine, because nothing reads it.
-- ---------------------------------------------------------------------------
alter table public.docs
  add column doc_class           public.doc_class  not null default 'canon',
  add column origin              public.doc_origin not null default 'human',
  add column source_ref          jsonb,
  add column body_text           text not null default '',
  add column headings            text not null default '',
  add column current_revision_id uuid,
  add column search_vector_v2    tsvector generated always as (
      setweight(to_tsvector('english', coalesce(title, '')),     'A')
   || setweight(to_tsvector('english', coalesce(headings, '')),  'B')
   || setweight(to_tsvector('english', coalesce(body_text, '')), 'C')
  ) stored;

-- Existing agent-authored docs keep honest provenance from day one.
update public.docs set origin = 'agent' where author_type = 'agent';
-- PR-sourced docs created by the integration pipeline are system-origin and
-- carry their source in frontmatter today; mirror it into source_ref.
update public.docs
   set origin     = 'system',
       source_ref = jsonb_build_object(
         'provider', 'github',
         'pr_url',   frontmatter->>'source_pr_url'
       )
 where frontmatter ? 'source_pr_url';

create index docs_search_v2_idx  on public.docs using gin (search_vector_v2);
create index docs_title_trgm     on public.docs using gin (title extensions.gin_trgm_ops);
create index docs_ws_class_idx   on public.docs (workspace_id, doc_class)
  where status <> 'archived';
-- (docs_space_idx already exists)

-- ---------------------------------------------------------------------------
-- api_keys (the spec's `agent_keys`): accountable owner + scopes.
-- Backfill owner to the key creator, else the workspace's first admin, else
-- the workspace's first member.
-- ---------------------------------------------------------------------------
alter table public.api_keys
  add column owner_user_id uuid references auth.users(id),
  add column scopes public.agent_scope[] not null default '{read,propose}';

update public.api_keys k
   set owner_user_id = coalesce(
     k.created_by,
     (select m.user_id from public.members m
       where m.workspace_id = k.workspace_id and m.role = 'admin'
       order by m.created_at asc limit 1),
     (select m.user_id from public.members m
       where m.workspace_id = k.workspace_id
       order by m.created_at asc limit 1)
   );

alter table public.api_keys alter column owner_user_id set not null;
create index api_keys_owner_idx on public.api_keys (owner_user_id);

-- ---------------------------------------------------------------------------
-- revisions (spec §2.2). Immutable, append-only history. document_id points
-- at today's `docs` table.
-- ---------------------------------------------------------------------------
create table public.revisions (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid not null references public.docs(id) on delete cascade,
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  seq                int  not null,
  title              text not null,
  body_md            text not null,
  frontmatter        jsonb not null default '{}'::jsonb,
  author_id          uuid references auth.users(id),   -- accountable party
  assisted_by        text[] not null default '{}',     -- disclosure: 'claude-code', 'cursor'
  agent_key_id       uuid references public.api_keys(id),
  parent_revision_id uuid references public.revisions(id),
  proposal_id        uuid,
  created_at         timestamptz not null default now(),
  unique (document_id, seq)
);

create index revisions_ws_idx     on public.revisions (workspace_id);
create index revisions_parent_idx on public.revisions (parent_revision_id);

-- docs.current_revision_id -> revisions. Added after the table exists.
alter table public.docs
  add constraint docs_current_revision_fkey
  foreign key (current_revision_id) references public.revisions(id);
create index docs_current_revision_idx on public.docs (current_revision_id);

-- ---------------------------------------------------------------------------
-- proposals (spec §2.2)
-- ---------------------------------------------------------------------------
create table public.proposals (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  space_id         uuid not null references public.spaces(id),
  document_id      uuid references public.docs(id) on delete cascade,  -- null = new doc
  base_revision_id uuid references public.revisions(id),
  title            text not null,
  body_md          text not null,
  frontmatter      jsonb not null default '{}'::jsonb,
  rationale        text,
  author_id        uuid references auth.users(id),
  assisted_by      text[] not null default '{}',
  agent_key_id     uuid references public.api_keys(id),
  state            public.proposal_state not null default 'open',
  auto_merged      boolean not null default false,
  review_note      text,
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  idempotency_key  text,
  created_at       timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index proposals_open_idx on public.proposals (workspace_id, state, created_at desc)
  where state = 'open';
create index proposals_ws_idx       on public.proposals (workspace_id);
create index proposals_author_idx   on public.proposals (author_id);
create index proposals_document_idx on public.proposals (document_id);
create index proposals_space_idx    on public.proposals (space_id);

-- revisions.proposal_id -> proposals (spec leaves it unconstrained; the FK is
-- free integrity now that both tables exist).
alter table public.revisions
  add constraint revisions_proposal_fkey
  foreign key (proposal_id) references public.proposals(id);
create index revisions_proposal_idx on public.revisions (proposal_id);

-- ---------------------------------------------------------------------------
-- document_links (spec §2.2)
-- ---------------------------------------------------------------------------
create table public.document_links (
  from_document_id uuid not null references public.docs(id) on delete cascade,
  to_document_id   uuid not null references public.docs(id) on delete cascade,
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  kind             text not null,   -- 'mentions' | 'touches' | 'supersedes'
  primary key (from_document_id, to_document_id, kind)
);

create index document_links_to_idx on public.document_links (to_document_id);
create index document_links_ws_idx on public.document_links (workspace_id);

-- ---------------------------------------------------------------------------
-- RLS (spec §2.3). Every policy: TO authenticated, InitPlan-wrapped
-- (select ...) helpers, indexes on every policy column (workspace_id,
-- author_id above).
--
-- revisions: select-only for members. Nothing has an insert policy — all
-- writes go through SECURITY DEFINER functions (the merge engine, step 4)
-- or the service-role backfill (step 3).
-- ---------------------------------------------------------------------------
alter table public.revisions enable row level security;

create policy revisions_read on public.revisions
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

alter table public.proposals enable row level security;

create policy proposals_read on public.proposals
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

create policy proposals_insert on public.proposals
  for insert to authenticated
  with check ( (select app.is_member(workspace_id)) and author_id = (select auth.uid()) );

-- Only the author may edit an open proposal; reviewers act via the
-- merge/reject functions (step 4).
create policy proposals_update_own on public.proposals
  for update to authenticated
  using ( author_id = (select auth.uid()) and state = 'open' );

alter table public.document_links enable row level security;

create policy document_links_read on public.document_links
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

-- NOTE: the spec's `documents_no_direct_write` policy on docs is deliberately
-- NOT added here — today's app writes docs directly and this step must be
-- behavior-neutral. It lands with the merge engine (step 4/6).

-- ---------------------------------------------------------------------------
-- DOWN (reversibility, up to the step-6 flip). Run in this order:
--
--   drop policy document_links_read on public.document_links;
--   drop policy proposals_update_own on public.proposals;
--   drop policy proposals_insert on public.proposals;
--   drop policy proposals_read on public.proposals;
--   drop policy revisions_read on public.revisions;
--   drop table public.document_links;
--   alter table public.revisions drop constraint revisions_proposal_fkey;
--   drop table public.proposals;
--   alter table public.docs drop constraint docs_current_revision_fkey;
--   drop table public.revisions;
--   alter table public.api_keys drop column scopes, drop column owner_user_id;
--   drop index public.docs_title_trgm;
--   alter table public.docs
--     drop column search_vector_v2, drop column current_revision_id,
--     drop column headings, drop column body_text, drop column source_ref,
--     drop column origin, drop column doc_class;
--   alter table public.spaces drop column review_policy;
--   drop function app.member_role(uuid);
--   drop function app.is_member(uuid);
--   drop schema app;
--   drop type public.agent_scope; drop type public.proposal_state;
--   drop type public.review_policy; drop type public.doc_origin;
--   drop type public.doc_class;
--   drop extension pg_trgm;   -- optional
-- ---------------------------------------------------------------------------
