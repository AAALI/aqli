-- Make integration connections workspace-scoped (one row per workspace+provider).
--
-- The original unique (workspace_id, user_id, provider) combined with reads
-- that maybeSingle() on (workspace_id, provider) caused: if a second member of
-- the same workspace also connected the provider, two rows existed and the
-- read either errored or returned the wrong row in downstream flows.
--
-- We keep `user_id` on the row as informational (the user who most recently
-- connected the provider) but enforce a single connection per workspace per
-- provider so reads, writes, and webhooks all agree on identity.

do $$
declare
  cn text;
begin
  select conname
    into cn
    from pg_constraint pc
    where pc.conrelid = 'public.integration_connections'::regclass
      and pc.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname::text)
        from unnest(pc.conkey) as k(attnum)
        join pg_attribute att
          on att.attrelid = pc.conrelid and att.attnum = k.attnum
      ) = array['provider','user_id','workspace_id'];

  if cn is not null then
    execute format(
      'alter table public.integration_connections drop constraint %I',
      cn
    );
  end if;
end$$;

alter table public.integration_connections
  drop constraint if exists integration_connections_workspace_provider_key;

alter table public.integration_connections
  add constraint integration_connections_workspace_provider_key
  unique (workspace_id, provider);
