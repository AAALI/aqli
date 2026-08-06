-- A place for a migration to record that a prerequisite actually ran.
--
-- Step 6 flips `body_md` to canonical. It is only safe after the step-2.5
-- backfill has regenerated `body_md` from `body_json` with the new serializer:
-- the markdown currently in the column was written by the old hand-rolled
-- converter, which measurably drops text (87 words across 27 documents on the
-- production copy — identifiers out of code spans, table cells and nested list
-- items). Flip before the backfill and those words are gone for good, because
-- `body_json` stops being the thing anyone reads.
--
-- That precondition is a script run by a person against a database, in an
-- environment the migration cannot see. So the script records that it ran, and
-- the migration refuses to apply without the record. An interlock rather than
-- a warning in a handover document.

create table if not exists app.migration_gates (
  name        text primary key,
  recorded_at timestamptz not null default now(),
  detail      jsonb not null default '{}'::jsonb
);

comment on table app.migration_gates is
  'One row per completed prerequisite. Written by scripts, read by migrations that must not run before them.';

revoke all on table app.migration_gates from public;
grant select, insert, update on table app.migration_gates to service_role;
grant select on table app.migration_gates to authenticated;

alter table app.migration_gates enable row level security;

-- No policy for `authenticated`: with RLS on and no permissive policy, members
-- read nothing. Only the service role (which bypasses RLS) writes here.

-- PostgREST cannot reach the `app` schema, so the backfill script gets a shim,
-- the same way the merge engine does.
create or replace function public.record_migration_gate(
  p_name   text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into app.migration_gates (name, recorded_at, detail)
  values (p_name, now(), coalesce(p_detail, '{}'::jsonb))
  on conflict (name) do update
    set recorded_at = excluded.recorded_at,
        detail      = excluded.detail;
$$;

revoke all on function public.record_migration_gate(text, jsonb) from public;
grant execute on function public.record_migration_gate(text, jsonb) to service_role;
