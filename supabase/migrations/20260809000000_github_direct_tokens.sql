-- Talk to GitHub directly instead of through Composio.
--
-- The Composio SDK cost 294 KiB gzipped in a 3 MiB Cloudflare Workers budget,
-- for OAuth, webhook delivery, and four REST calls. This migration adds the
-- storage that doing it directly needs: a GitHub token to call the API with,
-- and a secret to verify inbound webhooks against.
--
-- **Neither belongs on `integration_connections`.** That table's read policy is
-- "any member of the workspace", because the settings page shows connection
-- status to everyone. A token column there would be a personal access token
-- with repo scope, readable through PostgREST by every member of the
-- workspace including viewers. Postgres has no column-level RLS, so the
-- secrets go in their own table with RLS on and *no policies at all* — which
-- denies every role that respects RLS and leaves it reachable only by the
-- service role, i.e. only by server code in `lib/db`.

create table if not exists public.integration_secrets (
  connection_id uuid primary key
    references public.integration_connections(id) on delete cascade,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  -- A GitHub personal access token (classic or fine-grained). Stored as given:
  -- Postgres is encrypted at rest and this table is service-role only, so
  -- application-level encryption here would mean managing a key in the same
  -- environment as the token and buys little. Revocation is the real control,
  -- and it lives on GitHub.
  access_token text not null,
  -- Our own random secret, handed to GitHub when the repo hook is created and
  -- used to verify X-Hub-Signature-256 on the way back in. Per connection, so
  -- one workspace's secret cannot validate another's deliveries.
  webhook_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integration_secrets is
  'GitHub tokens and webhook secrets. RLS is enabled with no policies on purpose: only the service role may read this, never an end user session.';

alter table public.integration_secrets enable row level security;

-- Deliberately no policies, and no grants to authenticated or anon. The
-- service role bypasses RLS; everyone else gets nothing.
revoke all on table public.integration_secrets from authenticated, anon;

create index if not exists integration_secrets_workspace_idx
  on public.integration_secrets (workspace_id);

-- --- connections -----------------------------------------------------------

-- GitHub's numeric hook ids, one per watched repo, so a delivery can be traced
-- back to the connection that registered it and so the hooks can be removed on
-- disconnect. Parallel to `trigger_ids`, which held the Composio equivalent
-- and is left in place.
alter table public.integration_connections
  add column if not exists github_hook_ids bigint[] not null default '{}'::bigint[];

comment on column public.integration_connections.github_hook_ids is
  'Repo webhook ids returned by GitHub. The direct-GitHub equivalent of trigger_ids, which held Composio trigger ids.';

-- `composio_user_id` keeps its NOT NULL and keeps being written. Nothing reads
-- it on the direct path, but this swap is meant to be reversible — the
-- Composio code is commented rather than deleted — and a column that stopped
-- being populated would quietly make going back impossible for every
-- connection created in the meantime.
comment on column public.integration_connections.composio_user_id is
  'Unused by the direct-GitHub path but still written, so restoring the commented-out Composio integration stays possible.';
