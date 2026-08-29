-- Notifications that leave the app (ADOPTION.md F-5).
--
-- Mentions and review requests reach people through the in-app bell and
-- nowhere else. At small headcount that is survivable; for a team that lives in
-- chat it is the likeliest reason a pilot stalls, because the person who was
-- asked to review something never finds out.
--
-- This is deliberately the small version. Not email — there is no mail
-- transport in this repository and adding one is its own project, with its own
-- deliverability, bounce handling and unsubscribe surface. Not a Slack app
-- either: an outbound webhook is what Slack, Teams, Discord and every internal
-- tool already accept, so one implementation serves all of them and none of
-- them needs an OAuth flow.

begin;

create table if not exists workspace_webhooks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  url          text not null check (url ~ '^https://'),
  /**
   * Which events to send. Empty means all of them, so a webhook added without
   * thinking about it still does something useful.
   */
  events       text[] not null default '{}',
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  -- The last attempt, so an admin can see a misconfigured URL rather than
  -- wondering why chat is quiet.
  last_status       integer,
  last_error        text,
  last_delivered_at timestamptz
);

comment on table workspace_webhooks is
  'Outbound notifications: one POST per event to a chat tool. https only — these carry document titles.';

create index if not exists workspace_webhooks_workspace_idx on workspace_webhooks (workspace_id);

alter table workspace_webhooks enable row level security;

-- Admins only, for reading as well as writing. A webhook URL is a capability:
-- anyone holding it can post into the channel it points at.
drop policy if exists workspace_webhooks_admin on workspace_webhooks;
create policy workspace_webhooks_admin on workspace_webhooks
  for all to authenticated
  using ( (select app.member_role(workspace_id)) = 'admin' )
  with check ( (select app.member_role(workspace_id)) = 'admin' );

commit;
