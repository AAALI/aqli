-- What state is this installation actually in?
--
-- An Aqli instance can be serving pages and still be missing the migration
-- that puts RLS on comments, or still be reading `body_json` because the
-- canonical flip never happened. Both are invisible from the UI, and the only
-- way to find out today is to read `reports/HANDOVER.md` and run SQL by hand.
-- That is fine for the people who wrote it and a trap for everyone else — and
-- a self-hoster who trips it does not file a support ticket, they just have a
-- database where any authenticated user can read every workspace's comments.
--
-- So the checks live here, next to the thing they describe, and both the
-- `pnpm preflight` script and Settings → Health call this one function. A
-- second implementation in TypeScript would be a second thing to keep true.
--
-- Everything is guarded with `to_regclass` and catalogue lookups rather than
-- assuming a table exists: this function has to run on a database that is
-- behind, which is the only kind of database it is interesting on.

create or replace function app.preflight(p_expected_migrations text[] default '{}'::text[])
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  result           jsonb;
  applied          text[] := '{}';
  migrations_json  jsonb;
  rls_off          text[];
  rls_no_policy    text[];
  gates            jsonb;
  body_md_required boolean := false;
  at_risk          bigint  := 0;
  doc_count        bigint  := 0;
  bucket           jsonb   := 'null'::jsonb;
  unembedded       bigint  := null;
begin
  -- --- migrations ----------------------------------------------------------
  --
  -- `supabase_migrations.schema_migrations` is the CLI's ledger. A database
  -- migrated by hand (or the scratch cluster the SQL tests run on) has no such
  -- table, and that is not an error: it means "cannot tell", which the report
  -- says rather than guessing.
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select coalesce(array_agg(version order by version), ''{}'') from supabase_migrations.schema_migrations'
      into applied;

    migrations_json := jsonb_build_object(
      'tracked', true,
      'applied_count', cardinality(applied),
      'missing', to_jsonb(array(
        select m from unnest(p_expected_migrations) m
        where m <> all (applied)
        order by m
      )),
      'unknown', to_jsonb(array(
        select a from unnest(applied) a
        where a <> all (p_expected_migrations)
        order by a
      ))
    );
  else
    migrations_json := jsonb_build_object('tracked', false);
  end if;

  -- --- row-level security --------------------------------------------------
  --
  -- Two separate failures. A table with RLS disabled applies no restriction at
  -- all, so PostgREST hands its whole contents to any authenticated user. A
  -- table with RLS enabled and no policy is the opposite — it denies
  -- everything — which is safe but usually means a migration landed halfway.
  select coalesce(array_agg(c.relname order by c.relname), '{}')
    into rls_off
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  select coalesce(array_agg(c.relname order by c.relname), '{}')
    into rls_no_policy
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

  -- --- migration gates -----------------------------------------------------
  select coalesce(jsonb_object_agg(name, jsonb_build_object('recorded_at', recorded_at, 'detail', detail)), '{}'::jsonb)
    into gates
  from app.migration_gates;

  -- --- markdown canonical --------------------------------------------------
  --
  -- `body_md not null` is the observable half of the step-6 flip: the
  -- migration sets it, nothing else does.
  select coalesce(bool_and(a.attnotnull), false)
    into body_md_required
  from pg_attribute a
  where a.attrelid = to_regclass('public.docs')
    and a.attname = 'body_md'
    and not a.attisdropped;

  if to_regclass('public.docs') is not null then
    select count(*) into doc_count from docs;
    select count(*) into at_risk
    from docs
    where body_json is not null
      and body_json::text not in ('{"type":"doc"}', '{"type": "doc"}')
      and coalesce(body_md, '') = '';
  end if;

  -- --- retrieval -----------------------------------------------------------
  --
  -- An approved document with no chunks is invisible to every assistant and to
  -- Ask. The instance looks healthy and answers nothing, which is the hardest
  -- kind of broken to notice from the outside.
  if to_regclass('public.doc_chunks') is not null and to_regclass('public.docs') is not null then
    select count(*) into unembedded
    from docs d
    where d.status = 'approved'
      and not exists (select 1 from doc_chunks c where c.doc_id = d.id);
  end if;

  -- --- storage -------------------------------------------------------------
  if to_regclass('storage.buckets') is not null then
    select coalesce(
      (select jsonb_build_object(
                'exists', true,
                'public', b.public,
                'policies', (
                  select count(*) from pg_policies p
                  where p.schemaname = 'storage' and p.tablename = 'objects'
                    and p.qual like '%doc-images%'
                )
              )
         from storage.buckets b where b.id = 'doc-images'),
      jsonb_build_object('exists', false)
    ) into bucket;
  end if;

  result := jsonb_build_object(
    'generated_at', now(),
    'migrations', migrations_json,
    'rls', jsonb_build_object(
      'disabled', to_jsonb(rls_off),
      'enabled_without_policies', to_jsonb(rls_no_policy)
    ),
    'gates', gates,
    'markdown', jsonb_build_object(
      'body_md_required', body_md_required,
      'at_risk_docs', at_risk,
      'docs', doc_count
    ),
    'retrieval', jsonb_build_object(
      'chunks_table', to_regclass('public.doc_chunks') is not null,
      'search_function', to_regprocedure('public.search_doc_chunks(extensions.vector,uuid,integer)') is not null
                         or exists (select 1 from pg_proc where proname = 'search_doc_chunks'),
      'vector_extension', exists (select 1 from pg_extension where extname = 'vector'),
      'approved_without_chunks', unembedded
    ),
    'storage', bucket
  );

  return result;
end $$;

comment on function app.preflight(text[]) is
  'One report on whether this installation is in the state the code expects. Read by `pnpm preflight` and Settings → Health.';

-- PostgREST cannot reach the `app` schema, so the callers get a shim — the
-- same arrangement the merge engine and the gate recorder already use.
--
-- Two kinds of caller: the service role (the CLI, which has no `auth.uid()`)
-- and a signed-in admin (the Health page, on the RLS client). Anyone else is
-- refused: the report names tables, gates and counts, which is reconnaissance
-- rather than something an editor has any use for.
create or replace function public.preflight_report(p_expected_migrations text[] default '{}'::text[])
returns jsonb
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if auth.uid() is not null and not exists (
    select 1 from members m where m.user_id = auth.uid() and m.role = 'admin'
  ) then
    raise exception using
      errcode = '42501',
      message = 'preflight_report is available to workspace admins';
  end if;

  return app.preflight(coalesce(p_expected_migrations, '{}'::text[]));
end $$;

revoke all on function app.preflight(text[]) from public;
revoke all on function public.preflight_report(text[]) from public;
grant execute on function public.preflight_report(text[]) to service_role, authenticated;
