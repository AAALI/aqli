create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('github', 'linear')),
  status text not null default 'initiated' check (status in ('not_connected', 'initiated', 'connected', 'failed', 'expired', 'revoked')),
  composio_user_id text not null,
  connected_account_id text,
  trigger_ids text[] not null default '{}',
  default_space_id uuid references public.spaces(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  last_event_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);

create index if not exists integration_connections_workspace_idx
  on public.integration_connections(workspace_id);

create index if not exists integration_connections_composio_user_idx
  on public.integration_connections(composio_user_id);

alter table public.integration_connections enable row level security;

create policy "workspace members can read integration connections"
  on public.integration_connections for select
  using (
    exists (
      select 1 from public.members m
      where m.workspace_id = integration_connections.workspace_id
        and m.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage integration connections"
  on public.integration_connections for all
  using (
    exists (
      select 1 from public.members m
      where m.workspace_id = integration_connections.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.workspace_id = integration_connections.workspace_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );
