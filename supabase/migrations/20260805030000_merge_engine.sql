-- Step 4a of the markdown-canonical migration (spec §3, brief step 4).
--
-- The merge engine: disposition and merge in one Postgres function each, so a
-- write either lands completely or not at all. Nothing calls these yet — the
-- TypeScript side (step 4b) routes saves through them behind a feature flag.
--
-- ---------------------------------------------------------------------------
-- Where this deviates from spec §3.2, and why
-- ---------------------------------------------------------------------------
--
--   * `documents` -> `docs`, `owner_user_id` -> `owner_id`. This repo shipped
--     those names in its first migration; renaming is a step-6 concern.
--
--   * No `slug` on the insert. `docs` has no slug column — documents are
--     addressed by id (`/w/{ws}/docs/{id}`). `app.slugify` stays unused until
--     step 6 introduces one.
--
--   * No `audit_log` insert. There is no `audit_log` table; the equivalent is
--     `doc_activity`, and every call site already writes it (see
--     `lib/supabase/activity.ts`). Logging here too would double every entry
--     in the Home feed.
--
--   * `body_text`/`headings` are not set explicitly. The `docs_maintain_derived`
--     trigger derives them from `body_md` on every write, so setting them here
--     would just compute the same regexes twice.
--
--   * `last_reviewed_at` is opt-in via `p_mark_reviewed` rather than stamped
--     `now()` on every canon merge. The spec's version resets the staleness
--     clock on every autosave-sized edit, which is a user-visible change; step
--     4 must be behaviour-neutral. The review path passes true (matching
--     today's `approveDoc`), the editor path does not.
--
--   * `docs.type`, `docs.status` and `docs.agent_id` have no `proposals`
--     column. They are carried in `proposals.frontmatter` under the control
--     keys `doc_type`, `doc_status`, `agent_id` — the same channel spec §3.2
--     already uses for `doc_class` — and are read only when the proposal
--     creates a document. Merging into an existing document never touches its
--     type or status.

begin;

-- ---------------------------------------------------------------------------
-- proposals: two transitional columns
-- ---------------------------------------------------------------------------

-- `docs.body_json` is still what the editor renders until the step-6 flip, and
-- Postgres cannot run the markdown -> Tiptap converter. Carrying the JSON on
-- the proposal is what lets a merge update both representations atomically;
-- without it every merge would leave the editor showing stale content. Step 6
-- makes this dead weight.
alter table proposals add column if not exists body_json jsonb;

-- `docs.space_id` is nullable and the create-doc API accepts a null space, so
-- a NOT NULL here would make those documents unproposable. A null space means
-- no space policy: disposition falls back to the `review_agents` default.
alter table proposals alter column space_id drop not null;

comment on column proposals.body_json is
  'Transitional. Tiptap JSON mirroring body_md so a merge can keep docs.body_json in sync until the step-6 canonical flip.';

-- ---------------------------------------------------------------------------
-- Disposition (spec §3.1)
--
-- Kept in lockstep with `decideDisposition` in `lib/merge/disposition.ts`;
-- `lib/merge/__tests__/disposition.test.ts` asserts the full truth table for
-- the TypeScript copy.
-- ---------------------------------------------------------------------------
create or replace function app.decide_disposition(
  p_space_policy review_policy,
  p_actor_type   doc_origin,
  p_scopes       agent_scope[],
  p_doc_class    doc_class
)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select case
    -- Records are history, not claims. They are never subject to review.
    when p_doc_class = 'record' then 'merge'
    when p_space_policy = 'open' then 'merge'
    when p_space_policy = 'review_all' then 'queue'
    -- review_agents: people write freely, agents need the `write` scope.
    when p_actor_type = 'human' then 'merge'
    when 'write' = any(coalesce(p_scopes, '{}'::public.agent_scope[])) then 'merge'
    else 'queue'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Merge (spec §3.2)
--
-- Errors are the API's contract:
--   P0001 proposal_not_open  -> 409
--   P0002 stale_base         -> 409, with the document's current revision
--   P0003 forbidden          -> 403
--   P0004 document_not_found -> 404
-- ---------------------------------------------------------------------------
create or replace function app.merge_proposal(
  p_proposal_id   uuid,
  p_actor         uuid    default null,
  p_mark_reviewed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p        proposals%rowtype;
  d        docs%rowtype;
  new_rev  uuid;
  next_seq int;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found or p.state <> 'open' then
    raise exception 'proposal_not_open' using errcode = 'P0001';
  end if;

  -- SECURITY DEFINER, so the `proposals` RLS policies do not apply and this
  -- has to gate itself. `auth.uid()` is null when the caller is the service
  -- role — the server routes that use it verify membership before calling.
  if (select auth.uid()) is not null
     and coalesce(app.member_role(p.workspace_id), '') not in ('admin', 'editor') then
    raise exception 'forbidden' using errcode = 'P0003';
  end if;

  if p.document_id is not null then
    -- `for update` serialises concurrent merges on the same document: the
    -- second one sees the advanced current_revision_id and raises stale_base.
    select * into d from docs where id = p.document_id for update;
    if not found or d.workspace_id <> p.workspace_id then
      raise exception 'document_not_found' using errcode = 'P0004';
    end if;

    if d.current_revision_id is distinct from p.base_revision_id then
      raise exception 'stale_base' using errcode = 'P0002';
    end if;
  else
    insert into docs (
      workspace_id, space_id, title, type, status, owner_id,
      author_type, agent_id, doc_class, origin, frontmatter, body_md, body_json
    )
    values (
      p.workspace_id,
      p.space_id,
      p.title,
      coalesce(p.frontmatter->>'doc_type', 'general'),
      coalesce(p.frontmatter->>'doc_status', 'draft'),
      p.author_id,
      case when p.agent_key_id is not null then 'agent' else 'human' end,
      case when p.agent_key_id is not null
           then coalesce(p.frontmatter->>'agent_id', 'unknown') end,
      coalesce((p.frontmatter->>'doc_class')::doc_class, 'canon'),
      case when p.agent_key_id is not null then 'agent'::doc_origin
           else 'human'::doc_origin end,
      p.frontmatter,
      p.body_md,
      p.body_json
    )
    returning * into d;
  end if;

  select coalesce(max(seq), 0) + 1 into next_seq
  from revisions where document_id = d.id;

  insert into revisions (
    document_id, workspace_id, seq, title, body_md, frontmatter,
    author_id, assisted_by, agent_key_id, parent_revision_id, proposal_id
  )
  values (
    d.id, p.workspace_id, next_seq, p.title, p.body_md, p.frontmatter,
    p.author_id, p.assisted_by, p.agent_key_id, d.current_revision_id, p.id
  )
  returning id into new_rev;

  update docs set
    title               = p.title,
    body_md             = p.body_md,
    -- A proposal that carries no JSON (an agent, the PR ingester) leaves the
    -- cached Tiptap tree alone rather than blanking the editor.
    body_json           = coalesce(p.body_json, docs.body_json),
    frontmatter         = p.frontmatter,
    current_revision_id = new_rev,
    last_reviewed_at    = case
                            when p_mark_reviewed and d.doc_class = 'canon' then now()
                            else docs.last_reviewed_at
                          end
  where docs.id = d.id;

  update proposals set
    state       = 'merged',
    -- A proposal that created a document now points at it.
    document_id = coalesce(proposals.document_id, d.id),
    reviewed_by = p_actor,
    reviewed_at = now()
  where proposals.id = p.id;

  -- Any other open proposal written against the same base is now stale.
  -- `is not distinct from` because a document with no revisions has a null base.
  update proposals set
    state       = 'superseded',
    reviewed_at = now()
  where proposals.document_id = d.id
    and proposals.state = 'open'
    and proposals.base_revision_id is not distinct from p.base_revision_id
    and proposals.id <> p.id;

  return d.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reject
-- ---------------------------------------------------------------------------
create or replace function app.reject_proposal(
  p_proposal_id uuid,
  p_actor       uuid default null,
  p_note        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p proposals%rowtype;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found or p.state <> 'open' then
    raise exception 'proposal_not_open' using errcode = 'P0001';
  end if;

  if (select auth.uid()) is not null
     and coalesce(app.member_role(p.workspace_id), '') not in ('admin', 'editor') then
    raise exception 'forbidden' using errcode = 'P0003';
  end if;

  update proposals set
    state       = 'rejected',
    reviewed_by = p_actor,
    reviewed_at = now(),
    review_note = p_note
  where proposals.id = p.id;

  return p.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit: the one entry point every writer uses
--
-- Creates the proposal, decides its disposition, and merges it in the same
-- transaction when the disposition says so. That atomicity is the whole point:
-- a caller can never observe a proposal that should have merged but did not.
--
-- Returns jsonb rather than a composite so PostgREST hands back one object and
-- the out-parameter names cannot collide with the column names used inside.
-- ---------------------------------------------------------------------------
create or replace function app.submit_proposal(
  p_workspace_id     uuid,
  p_title            text,
  p_body_md          text,
  p_space_id         uuid    default null,
  p_document_id      uuid    default null,
  p_base_revision_id uuid    default null,
  p_frontmatter      jsonb   default '{}'::jsonb,
  p_body_json        jsonb   default null,
  p_rationale        text    default null,
  p_author_id        uuid    default null,
  p_assisted_by      text[]  default '{}'::text[],
  p_agent_key_id     uuid    default null,
  p_idempotency_key  text    default null,
  p_mark_reviewed    boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := (select auth.uid());
  v_author      uuid := p_author_id;
  v_space       uuid := p_space_id;
  v_base        uuid := p_base_revision_id;
  v_doc         docs%rowtype;
  v_policy      review_policy;
  v_scopes      agent_scope[];
  v_actor_type  doc_origin;
  v_doc_class   doc_class;
  v_disposition text;
  v_existing    proposals%rowtype;
  v_proposal    proposals%rowtype;
  v_document_id uuid;
begin
  -- A signed-in caller may only propose into their own workspace, as
  -- themselves. Anything else is the service role, whose callers verify
  -- membership before getting here.
  if v_uid is not null then
    if not (select app.is_member(p_workspace_id)) then
      raise exception 'forbidden' using errcode = 'P0003';
    end if;
    v_author := v_uid;
  end if;

  -- Idempotency: a retried agent write returns the first outcome rather than
  -- creating a second proposal. `proposals` already has the unique index.
  if p_idempotency_key is not null then
    select * into v_existing from proposals
    where workspace_id = p_workspace_id and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'proposal_id', v_existing.id,
        'document_id', v_existing.document_id,
        'state',       v_existing.state,
        'auto_merged', v_existing.auto_merged,
        'disposition', case when v_existing.auto_merged then 'merge' else 'queue' end,
        'replayed',    true
      );
    end if;
  end if;

  if p_document_id is not null then
    select * into v_doc from docs where id = p_document_id;
    if not found or v_doc.workspace_id <> p_workspace_id then
      raise exception 'document_not_found' using errcode = 'P0004';
    end if;
    v_space := coalesce(v_space, v_doc.space_id);
    -- A caller that passes no base is saying "merge onto whatever is current"
    -- — last-writer-wins, which is what the editor's autosave has always done.
    -- Optimistic concurrency is opt-in: pass the revision you actually read
    -- and a concurrent merge raises stale_base.
    v_base := coalesce(v_base, v_doc.current_revision_id);
  end if;

  if v_space is not null then
    select review_policy into v_policy from spaces
    where id = v_space and workspace_id = p_workspace_id;
    if not found then
      raise exception 'space_not_found' using errcode = 'P0005';
    end if;
  end if;
  -- No space, no space policy — fall back to the column's own default.
  v_policy := coalesce(v_policy, 'review_agents'::review_policy);

  if p_agent_key_id is not null then
    select scopes into v_scopes from api_keys
    where id = p_agent_key_id and workspace_id = p_workspace_id;
    if not found then
      raise exception 'agent_key_not_found' using errcode = 'P0006';
    end if;
    v_actor_type := 'agent'::doc_origin;
  else
    v_actor_type := coalesce(
      nullif(p_frontmatter->>'origin', '')::doc_origin,
      'human'::doc_origin
    );
  end if;

  v_doc_class := coalesce(
    nullif(p_frontmatter->>'doc_class', '')::doc_class,
    v_doc.doc_class,
    'canon'::doc_class
  );

  v_disposition := app.decide_disposition(v_policy, v_actor_type, v_scopes, v_doc_class);

  insert into proposals (
    workspace_id, space_id, document_id, base_revision_id, title, body_md,
    body_json, frontmatter, rationale, author_id, assisted_by, agent_key_id,
    auto_merged, idempotency_key
  )
  values (
    p_workspace_id, v_space, p_document_id, v_base, p_title, p_body_md,
    p_body_json, coalesce(p_frontmatter, '{}'::jsonb), p_rationale, v_author,
    coalesce(p_assisted_by, '{}'::text[]), p_agent_key_id,
    v_disposition = 'merge', p_idempotency_key
  )
  returning * into v_proposal;

  if v_disposition = 'merge' then
    v_document_id := app.merge_proposal(v_proposal.id, v_author, p_mark_reviewed);
    return jsonb_build_object(
      'proposal_id', v_proposal.id,
      'document_id', v_document_id,
      'state',       'merged',
      'auto_merged', true,
      'disposition', 'merge',
      'replayed',    false
    );
  end if;

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'document_id', v_proposal.document_id,
    'state',       'open',
    'auto_merged', false,
    'disposition', 'queue',
    'replayed',    false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
--
-- `authenticated` gets execute so the editor can call these over PostgREST as
-- the signed-in user; the membership checks above are what make that safe.
-- ---------------------------------------------------------------------------
revoke all on function app.decide_disposition(review_policy, doc_origin, agent_scope[], doc_class) from public;
revoke all on function app.merge_proposal(uuid, uuid, boolean) from public;
revoke all on function app.reject_proposal(uuid, uuid, text) from public;
revoke all on function app.submit_proposal(uuid, text, text, uuid, uuid, uuid, jsonb, jsonb, text, uuid, text[], uuid, text, boolean) from public;

grant execute on function app.decide_disposition(review_policy, doc_origin, agent_scope[], doc_class) to authenticated, service_role;
grant execute on function app.merge_proposal(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function app.reject_proposal(uuid, uuid, text) to authenticated, service_role;
grant execute on function app.submit_proposal(uuid, text, text, uuid, uuid, uuid, jsonb, jsonb, text, uuid, text[], uuid, text, boolean) to authenticated, service_role;

comment on function app.merge_proposal(uuid, uuid, boolean) is
  'Applies an open proposal: appends a revision, advances the document, supersedes rivals. Raises stale_base (P0002) when the document moved under the proposal.';
comment on function app.submit_proposal(uuid, text, text, uuid, uuid, uuid, jsonb, jsonb, text, uuid, text[], uuid, text, boolean) is
  'The universal write path. Creates a proposal and merges it in the same transaction when the space policy allows.';

commit;
