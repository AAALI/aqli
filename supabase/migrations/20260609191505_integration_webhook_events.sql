-- Dedupe + bookkeeping table for incoming Composio webhook deliveries.
-- Composio retries deliveries with the same `webhook-id` until it sees
-- a 2xx in time. Without a claim row the heavy pipeline (OpenAI, GitHub
-- enrichment, doc create/update, embedding) runs once per retry and
-- produces duplicate doc versions + noisy activity entries.
create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null,
  provider text not null check (provider in ('github', 'linear')),
  trigger_slug text,
  status text not null default 'pending' check (status in ('pending', 'done', 'error', 'ignored')),
  result jsonb,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, webhook_id)
);

create index if not exists integration_webhook_events_received_idx
  on public.integration_webhook_events (received_at desc);

-- Service-role only: the webhook handler is the sole writer and reader,
-- and it always uses the service client. Keeping RLS enabled with no
-- policies blocks everyone else by default.
alter table public.integration_webhook_events enable row level security;
