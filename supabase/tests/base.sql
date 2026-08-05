-- Pre-step-1 fixture: the schema as it stood before the markdown-canonical
-- migration, reconstructed from the live database's information_schema so the
-- real migration files can be replayed on top of it.

create schema if not exists extensions;
create schema if not exists auth;

-- --- auth stub -------------------------------------------------------------
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- `auth.uid()` reads a GUC so a test can switch identity mid-session.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

-- --- core tables -----------------------------------------------------------
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor',
  created_at timestamptz default now(),
  unique (workspace_id, user_id)
);

create table spaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  icon text default '📄',
  created_at timestamptz default now()
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  last_used_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create table docs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  space_id uuid references spaces(id),
  title text not null default 'Untitled',
  type text not null default 'general',
  status text not null default 'draft',
  owner_id uuid references auth.users(id),
  author_type text not null default 'human',
  agent_id text,
  body_json jsonb,
  body_md text,
  frontmatter jsonb default '{}'::jsonb,
  last_reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  search_vector tsvector
);

create table doc_versions (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references docs(id) on delete cascade,
  version_number int not null,
  body_md text not null,
  frontmatter jsonb,
  changed_by uuid references auth.users(id),
  change_type text,
  created_at timestamptz default now()
);

create table doc_activity (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references docs(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_type text not null default 'human',
  actor_id text,
  actor_name text,
  action text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table doc_comments (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references docs(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id uuid references auth.users(id),
  body text not null,
  comment_type text,
  created_at timestamptz default now()
);

-- The trigger step 1 replaces.
create or replace function docs_update_search_vector() returns trigger
language plpgsql as $$
begin
  new.search_vector :=
       setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(new.body_md, '')), 'B');
  new.updated_at := now();
  return new;
end;
$$;

create trigger docs_search_vector_update
  before insert or update on docs
  for each row execute function docs_update_search_vector();

create index docs_search_idx on docs using gin (search_vector);

-- Roles Supabase provides that the migrations grant to.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;
