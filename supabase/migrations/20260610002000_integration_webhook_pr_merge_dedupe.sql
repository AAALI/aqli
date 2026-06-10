-- Dedupe distinct webhook deliveries that describe the same merged PR.
-- Delivery-id dedupe catches retries of one Composio delivery; this key
-- catches separate deliveries for the same merge event.
alter table public.integration_webhook_events
  add column if not exists workspace_id uuid,
  add column if not exists pr_url text,
  add column if not exists pr_merged_at timestamptz;

create unique index if not exists integration_webhook_events_pr_merge_unique
  on public.integration_webhook_events (
    provider,
    workspace_id,
    pr_url,
    coalesce(pr_merged_at, 'epoch'::timestamptz)
  )
  where provider = 'github'
    and workspace_id is not null
    and pr_url is not null;
