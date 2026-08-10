-- Rollback for 20260809000000_github_direct_tokens.sql
--
-- Drops the secrets table, and with it every stored GitHub token and webhook
-- secret. That is not recoverable: the tokens were pasted in by hand and
-- exist nowhere else. Anyone who reconnects after this will paste a new one.
--
-- `composio_user_id` needs no repair: the direct path kept writing it for
-- exactly this reason, so every row still carries the identity the Composio
-- code expects.

begin;

drop table if exists public.integration_secrets;

drop index if exists public.integration_connections_github_hooks_idx;

alter table public.integration_connections
  drop column if exists github_hook_ids;

commit;
