-- Make the migrations check tell the truth on a renumbered ledger.
--
-- `app.preflight` compared `supabase_migrations.schema_migrations.version`
-- against the versions in this checkout. Those agree only if the folder has
-- never been renumbered — and on the installation this was written for they did
-- not agree at all: the ledger had `20260608105044_integration_connections`
-- where the folder has `20260608000000_integration_connections`, for twenty
-- migrations running. Same migrations, different stamps.
--
-- The result was a health page that permanently reported two dozen migrations
-- missing and two dozen unknown. Nobody can act on a report that is wrong every
-- time they read it, so when six migrations genuinely had not been applied —
-- and every workspace page 500'd because `blocked_space_ids` did not exist —
-- the report that was supposed to say so had been crying wolf for weeks.
--
-- A version is bookkeeping; the name is what identifies a migration. So return
-- the names too and let the caller match on either. Nothing else changes: this
-- is `create or replace` on one function, adding one key to the JSON it
-- returns.

begin;

create or replace function app.preflight(p_expected_migrations text[] default '{}'::text[])
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  result           jsonb;
  applied          text[] := '{}';
  applied_names    text[] := '{}';
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
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select coalesce(array_agg(version order by version), ''{}'') from supabase_migrations.schema_migrations'
      into applied;

    -- `name` is nullable in the CLI's ledger and absent on very old ones, so
    -- this is guarded separately rather than folded into the query above.
    -- Ordered by *version*, exactly like `applied` above, and nulls kept as ''
    -- so the two arrays stay index-aligned: the caller pairs them up to decide
    -- whether a ledger row it does not recognise by version is one it knows by
    -- name. Sorting these by name instead would silently scramble that pairing.
    begin
      execute 'select coalesce(array_agg(coalesce(name, '''') order by version), ''{}'') from supabase_migrations.schema_migrations'
        into applied_names;
    exception when undefined_column then
      applied_names := '{}';
    end;

    migrations_json := jsonb_build_object(
      'tracked', true,
      'applied_count', cardinality(applied),
      -- Both lists, ordered by version, so the caller can pair them.
      'applied', to_jsonb(applied),
      'applied_names', to_jsonb(applied_names),
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

commit;
