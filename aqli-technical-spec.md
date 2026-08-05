# Aqli — technical spec

Implementation detail for the architecture doc. Everything here is measured against your
repo at `36558b5` and your actual Confluence export, not assumed.

---

# 1. Fresh start or evolve?

**Evolve. Starting fresh would be a mistake, and the codebase says so clearly.**

I measured the blast radius of the three big changes:

| Change | Files touched |
|---|---|
| Flip canonical to markdown (`body_json` → `body_md`) | **9 files** |
| Delete embeddings | **17 files**, mostly net deletions |
| Replace `status` as trust boundary with proposals | 32 files, but ~20 are display-only |

And here's what survives untouched, out of 22,034 LOC:

| Asset | LOC | Verdict |
|---|---|---|
| Auth, middleware, members, invitations, workspace bootstrap | ~900 | **Keep as-is.** The `SECURITY DEFINER` bootstrap and RLS model are correct and were hard-won |
| `components/editor/v2/*` — slash menu, selection toolbar, rail, cowrite | 2,230 | **Keep.** Only the schema allowlist changes |
| `lib/integrations/source/*` — the PR pipeline | 1,206 | **Keep and promote.** This is now a core content source |
| UI primitives, layout, command palette, auth screens | ~1,700 | Keep |

The PR pipeline finding is the one that decides it. `feature-doc.ts` already has
`processPullRequestData`, `createChangeDoc`, `findMatchingDoc`, `updateMatchedDoc` and
`resolveMergedPullRequest`. **You already built most of Decision 4's ingestion** — it needs
re-pointing at `doc_class = 'record'` plus backlinks, not writing from scratch. Interestingly
both patterns are in there: `createChangeDoc` (page per PR — the one I'd keep) and
`updateMatchedDoc` (auto-edit the matched doc — the one I'd retire, since silently rewriting
someone's doc is the exact trust problem the review gate exists for).

Starting fresh would throw away working auth, a real editor, and a PR pipeline — and
reintroduce the cross-workspace authorization bugs you already fixed in `d2be77a`.

**But do it on a long-lived branch with a schema cutover, not incrementally on `main`.** The
proposals model and the markdown flip are not independently shippable; half-migrated is worse
than either end state. Plan for one merge, roughly three weeks in.

---

# 2. Schema

Postgres 15+ / Supabase. Every policy follows the measured RLS performance rules: wrap
`auth.uid()` in a `select` to force an InitPlan (Supabase reports 11,000ms → 7ms on one of
their tests), index every column used in a policy (~100× on large tables), use
`SECURITY DEFINER` helpers to avoid re-evaluating joins (178,000ms → 12ms), and always
specify `TO authenticated` (170ms → <0.1ms).

## 2.1 Enums and helpers

```sql
create type doc_class      as enum ('canon', 'record');
create type doc_origin     as enum ('human', 'agent', 'system');
create type review_policy  as enum ('open', 'review_agents', 'review_all');
create type proposal_state as enum ('open', 'merged', 'rejected', 'superseded');
create type agent_scope    as enum ('read', 'propose', 'write');

-- SECURITY DEFINER so policies don't re-run the members join under RLS.
create or replace function app.is_member(ws uuid)
returns boolean language sql security definer stable
set search_path = public, pg_temp as $$
  select exists (
    select 1 from members
    where workspace_id = ws and user_id = (select auth.uid())
  );
$$;

create or replace function app.member_role(ws uuid)
returns text language sql security definer stable
set search_path = public, pg_temp as $$
  select role from members
  where workspace_id = ws and user_id = (select auth.uid());
$$;
```

## 2.2 Core tables

```sql
create table spaces (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  slug          text not null,
  name          text not null,
  review_policy review_policy not null default 'review_agents',
  created_at    timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table documents (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  space_id            uuid not null references spaces(id),
  slug                text not null,
  title               text not null,
  doc_class           doc_class  not null default 'canon',
  origin              doc_origin not null default 'human',
  source_ref          jsonb,              -- {provider, pr_url, sha, merged_at}
  frontmatter         jsonb not null default '{}'::jsonb,
  body_md             text not null default '',
  body_text           text not null default '',   -- markdown stripped, for indexing
  headings            text not null default '',   -- headings only, weighted higher
  current_revision_id uuid,
  owner_user_id       uuid references auth.users(id),
  last_reviewed_at    timestamptz,        -- canon only
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  search_vector tsvector generated always as (
      setweight(to_tsvector('english', coalesce(title, '')),    'A')
   || setweight(to_tsvector('english', coalesce(headings, '')), 'B')
   || setweight(to_tsvector('english', coalesce(body_text, '')),'C')
  ) stored,
  unique (workspace_id, slug)
);

create index documents_search_idx  on documents using gin (search_vector);
create index documents_title_trgm  on documents using gin (title gin_trgm_ops);
create index documents_ws_class_idx on documents (workspace_id, doc_class)
  where archived_at is null;
create index documents_space_idx   on documents (space_id);

create table revisions (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid not null references documents(id) on delete cascade,
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  seq                int  not null,
  title              text not null,
  body_md            text not null,
  frontmatter        jsonb not null default '{}'::jsonb,
  author_id          uuid references auth.users(id),  -- accountable party
  assisted_by        text[] not null default '{}',    -- disclosure: 'claude-code', 'cursor'
  agent_key_id       uuid references agent_keys(id),
  parent_revision_id uuid references revisions(id),
  proposal_id        uuid,
  created_at         timestamptz not null default now(),
  unique (document_id, seq)
);

create table proposals (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  space_id         uuid not null references spaces(id),
  document_id      uuid references documents(id) on delete cascade,  -- null = new doc
  base_revision_id uuid references revisions(id),
  title            text not null,
  body_md          text not null,
  frontmatter      jsonb not null default '{}'::jsonb,
  rationale        text,
  author_id        uuid references auth.users(id),
  assisted_by      text[] not null default '{}',
  agent_key_id     uuid references agent_keys(id),
  state            proposal_state not null default 'open',
  auto_merged      boolean not null default false,
  review_note      text,
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  idempotency_key  text,
  created_at       timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index proposals_open_idx on proposals (workspace_id, state, created_at desc)
  where state = 'open';

create table document_links (
  from_document_id uuid not null references documents(id) on delete cascade,
  to_document_id   uuid not null references documents(id) on delete cascade,
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  kind             text not null,   -- 'mentions' | 'touches' | 'supersedes'
  primary key (from_document_id, to_document_id, kind)
);
create index document_links_to_idx on document_links (to_document_id);

create table agent_keys (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  key_hash      text not null unique,      -- sha256, never the raw key
  key_prefix    text not null,             -- 'aqli_live_ab12' for display
  owner_user_id uuid not null references auth.users(id),   -- always accountable
  scopes        agent_scope[] not null default '{read,propose}',
  space_ids     uuid[],                    -- null = all spaces
  expires_at    timestamptz,
  revoked_at    timestamptz,
  last_used_at  timestamptz
);
```

## 2.3 RLS

```sql
alter table documents enable row level security;

create policy documents_read on documents
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

-- Nobody writes documents directly. Merging happens in a SECURITY DEFINER function.
create policy documents_no_direct_write on documents
  for all to authenticated using (false) with check (false);

alter table proposals enable row level security;

create policy proposals_read on proposals
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

create policy proposals_insert on proposals
  for insert to authenticated
  with check ( (select app.is_member(workspace_id)) and author_id = (select auth.uid()) );

-- Only the author may edit an open proposal; reviewers act via the merge/reject functions.
create policy proposals_update_own on proposals
  for update to authenticated
  using ( author_id = (select auth.uid()) and state = 'open' );
```

`revisions` is select-only for members; nothing has an insert policy. All writes go through
functions.

## 2.4 The agent path, and closing the service-role footgun

Agents authenticate with a bearer key, not a Supabase session, so RLS doesn't apply — the API
uses the service-role client. That's exactly the shape that produced your cross-workspace
bugs. Make it impossible rather than remembered:

```ts
// lib/db/scoped.ts — the ONLY exported way to get a service client.
export type Scoped = { workspaceId: string; actor: Actor };

export async function withWorkspace<T>(
  auth: AgentAuth | UserAuth,
  fn: (db: ScopedClient, scope: Scoped) => Promise<T>,
): Promise<T>
```

`ScopedClient` wraps PostgREST so every `.from(table)` automatically appends
`.eq('workspace_id', scope.workspaceId)`. Ban the raw `createServiceClient` import with an
ESLint `no-restricted-imports` rule outside `lib/db/`. That converts a discipline problem into
a lint error.

---

# 3. The merge engine

The heart of the system. One Postgres function so disposition and merge are atomic.

## 3.1 Disposition

```ts
export function decideDisposition(input: {
  spacePolicy: ReviewPolicy;
  actorType: 'human' | 'agent' | 'system';
  scopes: AgentScope[];
  docClass: DocClass;
}): 'merge' | 'queue' {
  // Records are history, not claims. They are never subject to review.
  if (input.docClass === 'record') return 'merge';

  switch (input.spacePolicy) {
    case 'open':          return 'merge';
    case 'review_all':    return 'queue';
    case 'review_agents':
      if (input.actorType === 'human') return 'merge';
      return input.scopes.includes('write') ? 'merge' : 'queue';
  }
}
```

Two things worth being deliberate about. **`review_all` queues humans too** — that's the point
of a compliance space, and it's what lets a regulated team adopt this. And **records bypass
review entirely**, because a queue of "did this PR really merge?" approvals is nonsense; the
review that matters happened in GitHub.

## 3.2 Merge

```sql
create or replace function app.merge_proposal(p_proposal_id uuid, p_actor uuid)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  p proposals%rowtype;
  d documents%rowtype;
  new_rev uuid;
  next_seq int;
begin
  select * into p from proposals where id = p_proposal_id for update;
  if not found or p.state <> 'open' then
    raise exception 'proposal_not_open' using errcode = 'P0001';
  end if;

  if p.document_id is not null then
    select * into d from documents where id = p.document_id for update;  -- serialize writers

    -- Optimistic concurrency: the doc must not have moved since the proposal was written.
    if d.current_revision_id is distinct from p.base_revision_id then
      raise exception 'stale_base' using errcode = 'P0002';
    end if;
  else
    insert into documents (workspace_id, space_id, slug, title, doc_class, origin, owner_user_id)
    values (p.workspace_id, p.space_id, app.slugify(p.title), p.title,
            coalesce((p.frontmatter->>'doc_class')::doc_class, 'canon'),
            case when p.agent_key_id is not null then 'agent' else 'human' end,
            p.author_id)
    returning * into d;
  end if;

  select coalesce(max(seq), 0) + 1 into next_seq from revisions where document_id = d.id;

  insert into revisions (document_id, workspace_id, seq, title, body_md, frontmatter,
                         author_id, assisted_by, agent_key_id, parent_revision_id, proposal_id)
  values (d.id, p.workspace_id, next_seq, p.title, p.body_md, p.frontmatter,
          p.author_id, p.assisted_by, p.agent_key_id, d.current_revision_id, p.id)
  returning id into new_rev;

  update documents set
    title               = p.title,
    body_md             = p.body_md,
    body_text           = app.md_to_text(p.body_md),
    headings            = app.md_headings(p.body_md),
    frontmatter         = p.frontmatter,
    current_revision_id = new_rev,
    last_reviewed_at    = case when d.doc_class = 'canon' then now() else null end,
    updated_at          = now()
  where id = d.id;

  update proposals set state = 'merged', reviewed_by = p_actor, reviewed_at = now()
  where id = p.id;

  -- Any other open proposal on the same base is now stale.
  update proposals set state = 'superseded'
  where document_id = d.id and state = 'open' and base_revision_id = p.base_revision_id
    and id <> p.id;

  insert into audit_log (workspace_id, actor_type, actor_id, action, target)
  values (p.workspace_id,
          case when p.agent_key_id is not null then 'agent' else 'human' end,
          coalesce(p_actor, p.author_id), 'merge', d.id::text);

  return d.id;
end; $$;
```

`for update` on the document row is what makes concurrent merges safe — the second one sees
the advanced `current_revision_id` and raises `stale_base`, which the API surfaces as **409
with the current revision** so an agent can re-read and re-propose. That's your rebase.

`app.md_to_text` and `app.md_headings` are deliberately simple SQL regex functions (strip
fences, links, emphasis; extract `^#{1,6}` lines). Doing it in the database keeps
`search_vector` correct no matter which path wrote the row.

---

# 4. Markdown pipeline

## 4.1 The allowlist

Canonical is `body_md`. The editor is Tiptap, but its schema is constrained to exactly what
round-trips:

**Nodes:** `doc`, `paragraph`, `heading` (1–3), `bulletList`, `orderedList`, `listItem`,
`taskList`, `taskItem`, `codeBlock` (with language), `blockquote`, `horizontalRule`, `table`
(+row/cell/header), `image`, `hardBreak`.
**Marks:** `bold`, `italic`, `code`, `strike`, `link`.
**Callouts:** GFM alert syntax — `> [!NOTE]`, `> [!WARNING]` — stored as a blockquote with an
attribute. No custom node type, so it survives any markdown consumer.

Everything else is rejected at the schema level, which means the editor cannot produce content
the serializer would silently drop.

## 4.2 Round-trip safety is a test, not a hope

Use `prosemirror-markdown` with explicit custom serializers rather than a convenience wrapper,
so every node has a defined output. Then make lossiness a CI failure:

```ts
// Property test — the whole markdown decision rests on this.
test.prop([arbitraryMarkdown()])('md → pm → md is stable', (md) => {
  const once  = serialize(parse(md));
  const twice = serialize(parse(once));
  expect(twice).toBe(once);        // idempotent after one normalization pass
});
```

Note it asserts *stability*, not exact equality with the input — the first pass normalizes
(`*` → `-`, setext → ATX). Requiring byte-equality on arbitrary input would fail forever;
requiring a fixed point after one pass is both achievable and sufficient, because it
guarantees no content is lost on repeated edits.

Also run the corpus check as a one-off gate: parse and re-serialize all 1,361 imported pages,
and fail the import if any document isn't a fixed point.

## 4.3 Autosave

Unchanged in shape from what you have — your single-flight queue in `DocEditorClient` is good
work. Two edits: it serializes to markdown instead of JSON, and in an `open` space the save
merges immediately (so it feels like Notion), while in `review_all` it accumulates into one
open proposal per author per document rather than one per keystroke burst.

---

# 5. Search

## 5.1 The query

```sql
create or replace function app.search_docs(
  p_workspace uuid,
  p_query     text,
  p_classes   doc_class[] default array['canon']::doc_class[],
  p_space     uuid default null,
  p_limit     int default 20,
  p_offset    int default 0
) returns table (
  document_id uuid, title text, slug text, space_slug text,
  doc_class doc_class, snippet text, rank real, matched_total bigint
) language sql stable as $$
  with q as (select websearch_to_tsquery('english', p_query) as tsq),
  hits as (
    select d.*,
           ts_rank_cd('{0.1,0.3,0.6,1.0}', d.search_vector, q.tsq) as r
    from documents d, q
    where d.workspace_id = p_workspace
      and d.archived_at is null
      and d.doc_class = any(p_classes)
      and (p_space is null or d.space_id = p_space)
      and d.search_vector @@ q.tsq
  ),
  total as (select count(*) as n from hits)
  select h.id, h.title, h.slug, s.slug, h.doc_class,
         ts_headline('english', h.body_text, (select tsq from q),
                     'MaxFragments=2, MinWords=12, MaxWords=28, StartSel=**, StopSel=**'),
         h.r, (select n from total)
  from hits h join spaces s on s.id = h.space_id
  order by h.r desc, h.updated_at desc
  limit p_limit offset p_offset;
$$;
```

Details that matter: `websearch_to_tsquery` (not `plainto_`) so users get quoted phrases and
`-exclusion` for free. `ts_rank_cd` with an explicit weight array so a title match beats a
body match — the default weights are flatter than you want. `matched_total` is returned
separately from the page, which is the fix for the agent API's `total: results.length` lie.
Default `p_classes = {canon}` is Decision 4 enforced at the lowest level, so no caller can
accidentally flood itself with PR pages.

## 5.2 Typo tolerance

`websearch_to_tsquery` gives prefix matching but not fuzziness. Two-stage: if the tsquery
returns fewer than 3 rows, fall back to trigram on `title` (`title % p_query order by
similarity(title, p_query) desc`). Cheap, uses the GIN trgm index, and covers the "searched
for `Tabadualt`" case without a second search engine.

## 5.3 The eval harness

`evals/queries.yaml`, checked in, run in CI:

```yaml
- q: "how do we calculate custody fees"
  expect_any: [custody-fees-service, trading-flow-fees]
- q: "ERR_ORDER_REJECTED"          # exact-token — the lexical strong case
  expect_any: [oms-error-codes]
- q: "what happens when a KYC check fails"   # paraphrase — the vector case
  expect_any: [kyc-statuses-transitions]
```

Report recall@10 overall and split by query kind. **The paraphrase bucket is the number that
decides whether Decision 2 holds.** Run it canon-only and canon+records so you can see
precisely what records cost you in precision.

---

# 6. MCP server

Stateless Streamable HTTP, spec `2026-07-28`, deployed as a Worker with `createMcpHandler`.

## 6.1 Tools

```jsonc
{
  "name": "search_docs",
  "description": "Search approved team knowledge. Prefer several narrow searches over one broad one. Returns snippets; call read_doc for full content.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query":   { "type": "string" },
      "space":   { "type": "string", "description": "Space slug to scope to." },
      "include": { "type": "array", "items": { "enum": ["canon", "record"] },
                   "default": ["canon"],
                   "description": "canon = living docs. record = PR/incident history; include only for 'why did this change' questions." },
      "limit":   { "type": "integer", "minimum": 1, "maximum": 25, "default": 10 },
      "response_format": { "enum": ["concise", "detailed"], "default": "concise" }
    },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

Plus `read_doc(id, offset?, limit?)`, `grep_docs(pattern, space?, class?)`,
`list_docs(space?, updated_since?)`, and:

```jsonc
{
  "name": "propose_change",
  "description": "Propose a new document or an edit. In reviewed spaces this queues for human approval and does NOT take effect immediately.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "document_id":      { "type": "string" },
      "base_revision_id": { "type": "string", "description": "From read_doc. Required when editing." },
      "title":            { "type": "string" },
      "body_md":          { "type": "string" },
      "rationale":        { "type": "string", "description": "Why. Shown to the reviewer." },
      "assisted_by":      { "type": "array", "items": { "type": "string" } },
      "idempotency_key":  { "type": "string" }
    },
    "required": ["title", "body_md", "rationale"],
    "additionalProperties": false
  }
}
```

Response is explicit about what happened, because the agent must not report success on a
queued change:

```json
{ "status": "queued_for_review", "proposal_id": "...", "review_url": "https://...",
  "message": "Queued for human review in Engineering. Not yet visible to other agents." }
```

or `{"status": "merged", "document_id": "...", "revision_id": "..."}`.

**No `approve` tool.** **No `delete` tool.**

Every response is token-budgeted: hard cap ~20k tokens, per-item truncation with
`"truncated": true`, and `matched_total` alongside `returned` so the agent can decide to
narrow instead of paginating blindly.

## 6.2 Server instructions

With tool search on by default in Claude Code, the `instructions` field is what makes Claude
reach for your server at all. Treat it as product copy:

> Aqli is this team's knowledge base — architecture decisions, runbooks, API contracts,
> compliance policies. Search here before answering questions about how this company's
> systems work, and before writing docs. Prefer several narrow searches. If you learn
> something that contradicts a document, call `propose_change` on it.

## 6.3 Auth

OAuth 2.1 Resource Server. Validate signature, issuer (RFC 9207), **audience** (RFC 8707),
expiry and scope on every request. Workspace comes from the token claim — never a tool
argument. CIMD, not DCR. For CI agents, long-lived `aqli_live_*` keys hashed with sha256,
scoped to spaces, with an owner and an expiry.

---

# 7. PR ingestion → records

```
GitHub webhook → verify HMAC → dedupe on delivery id (you have this)
  → ctx.waitUntil / Queue
  → fetch PR: title, body, files, additions/deletions, linked issues
  → LLM summarizes into markdown (workspace's own model via AI Gateway)
  → proposal { doc_class: 'record', origin: 'system' } → auto-merges
  → extract links → document_links(kind='touches')
```

**Record page shape** — keep it tight, it's a citation target not an essay:

```markdown
---
type: record
source: github
pr: https://github.com/org/repo/pull/482
merged_at: 2026-08-03T14:22:00Z
authors: [ali]
touches: [oms-architecture, order-status-webhooks]
---
# Order status webhook retry logic

**What changed.** Retries now use exponential backoff capped at 5 attempts …

**Why.** ZagTrader was returning 503s during market open …

**Affects.** `platform-orders-service`, `oms-architecture` doc
```

**Linking to canon** is where the value is, and I'd do it in two passes: cheap first (slugs
and file paths named in the diff matched against `documents.slug` and
`frontmatter.code_paths`), then let the LLM propose additional links which are stored with
lower confidence and only surfaced in the UI, never fed to retrieval.

**The staleness signal** — this is the feature that sells the product:

```sql
select d.id, d.title, count(l.from_document_id) as merges_since_review
from documents d
join document_links l on l.to_document_id = d.id and l.kind = 'touches'
join documents r on r.id = l.from_document_id and r.doc_class = 'record'
where d.doc_class = 'canon'
  and r.created_at > coalesce(d.last_reviewed_at, d.created_at)
group by d.id having count(*) >= 3;
```

"This runbook has had 12 merges behind it since anyone reviewed it" is strictly better than a
90-day timer, and Confluence structurally cannot produce it.

**Cost control:** only summarize PRs that touch paths declared in a space's `code_paths`, or
that carry a `docs:` label. Otherwise you generate 200 pages a month about dependency bumps.

---

# 8. Confluence importer

I counted the actual markup in your `bodycontent.csv` (58 MB, 1,361 pages). The importer is a
bounded task, not an open-ended one.

**Macros present, by frequency:**

| Macro | Count | Handling |
|---|---|---|
| `status` | 3,105 | → `` `BADGE` `` inline code, or a GFM alert |
| `code` | 2,394 | → fenced block, `ac:parameter[language]` → info string |
| `view-file` | 221 | → link to migrated attachment in R2 |
| `info` / `note` / `tip` | 224 | → `> [!NOTE]` / `> [!WARNING]` / `> [!TIP]` |
| `jira` | 172 | → link, using `key` parameter |
| `toc` | 158 | **drop** — regenerate from headings |
| `mermaid-cloud`, `mermaid`, `mermaid-macro` | 72 | → ```` ```mermaid ```` fence. Big win — these become native |
| `drawio`, `inc-drawio`, `drawio-sketch` | 83 | → export PNG to R2 + link. No clean text form |
| `expand` | 8 | → `<details><summary>` |
| `children`, `roadmap`, `recently-updated`, `contributors`, `panel` | 22 | drop with a `<!-- unsupported -->` marker |

**Non-macro elements:**

| Element | Count | Handling |
|---|---|---|
| `ac:inline-comment-marker` | **8,158** | **Unwrap — keep inner text, drop the tag.** Highest-frequency element and pure noise; miss this and every page is garbage |
| `ac:link` + `ri:page` | 6,494 | → `[text](/w/ws/docs/slug)`. Two-pass: import all pages first, then rewrite by title |
| `ac:image` + `ri:attachment` | 4,643 | → R2, `![alt](url)` |
| `ri:user` | 2,239 | → `@name`, resolved via `user_mapping.csv` in the export |
| `ac:layout` | 2,090 | → flatten columns to sequential sections |
| `ac:adf-extension` | 1,778 | Newer ADF-in-storage-format. Inspect these — they hide panels/expands |
| `ac:task-list` | 195 | → `- [ ]` / `- [x]` |

Plain HTML is conventional: 85,896 `<strong>`, 20,754 `<ul>`, 12,856 `<code>`, 7,613 `<table>`,
8,998 `<hr>`. Notably **zero `<pre>` and zero `<img>`** — all code is in the `code` macro and
all images are `ac:image`, so you don't need those paths.

**Approach.** Don't reach for an existing converter — the maintained options are thin
(`highsource/confluence-to-markdown-converter` is XSLT, 71 stars, stale; `markitdown` has an
open feature request for this). Write a `unified`/`rehype` pipeline with a handler per element
above. **~10 macro handlers and ~7 element handlers cover essentially the entire corpus** —
call it 400 lines.

**Pipeline:** parse `content.csv` (page tree, titles, spaceid) + `bodycontent.csv` (bodies)
→ pass 1 create all documents with a `confluence_id` in frontmatter → pass 2 rewrite links by
resolved id → attachments from `attachments/{pageId}/{attachmentId}/{version}` to R2 →
comments (611) into `document_comments` → whiteboards (8) exported as images.

**Gate:** every imported page must be a markdown round-trip fixed point (§4.2). Report a
per-page fidelity score and let a human spot-check the worst 20.

---

# 9. Migration order

On a branch. Each step is independently testable; only step 6 is a one-way door.

1. **Add tables.** `spaces.review_policy`, `proposals`, `document_links`, new columns on
   `documents`, `agent_keys.owner_user_id` + `scopes`. Nothing reads them yet.
2. **Backfill markdown.** `body_md` from `body_json` for every doc, then run the round-trip
   gate. Fix the serializer until every existing doc is a fixed point. **Do not proceed until
   this is clean** — it's the cheapest possible time to find out the markdown decision has a
   hole.
3. **Backfill revisions** from `doc_versions`, preserving order into `seq`.
4. **Ship the merge engine** behind a flag. Route human saves through `propose → merge` in
   `open` spaces. Behaviour should be identical to today from the user's seat.
5. **Route agents through proposals.** Delete `updateAgentDoc`. This closes the trust-boundary
   bug (review finding 2.3) by construction.
6. **Flip canonical.** `body_md` becomes the source, `body_json` becomes a derived cache. One
   deploy, one-way.
7. **Delete embeddings.** Drop `doc_chunks`, `lib/ai/chunker|context|embedder`, the six
   `/api/ai/*` retrieval callers. Run the eval set against tsvector first and keep the table
   for 30 days.
8. **Records.** Re-point `feature-doc.ts` at `doc_class='record'`, retire `updateMatchedDoc`,
   add `document_links` and the staleness query.
9. **MCP server.** New package, new Worker.
10. **Importer.** Independent of everything above; can be built in parallel from day one.

Steps 1–3 are safe on `main` today. Step 2 is the one that tells you early whether any of this
works, so do it first and treat its output as the go/no-go for the whole plan.

---

# 10. How the stack changes

Short answer: **the stack barely changes. The topology and the data layer do.** Every
framework choice you made survives — Next.js 16, React 19, Tiptap 3, Tailwind 4, Supabase,
Workers via OpenNext, PostHog, vitest, wrangler. This is not a re-platform.

## 10.1 Dependencies

**Removed**

| Package | Why |
|---|---|
| `@composio/core` | See 10.4 — GitHub becomes core, and you want to own it |
| *(embedding usage of `openai`)* | The package stays for the copilot; the `embeddings.create` path goes |

**Added**

| Package | For |
|---|---|
| `prosemirror-markdown` | Explicit serializers per node — not a convenience wrapper (§4.2) |
| `unified` + `remark-parse` / `remark-gfm` / `rehype-parse` | Markdown → PM on read, and the Confluence importer |
| `gray-matter` | YAML frontmatter split |
| `@modelcontextprotocol/sdk` + `agents` (Cloudflare) | The MCP server |
| `diff` | Markdown diffs in the review queue — this is the review UI |
| `fast-check` | The round-trip property test. Non-negotiable given Decision 1 |
| `@octokit/webhooks` + `@octokit/app` | Once Composio is replaced |

Net: minus one meaningful dependency, plus six small ones. `openai` stays but changes role —
from "the AI vendor" to "an OpenAI-shaped client pointed at AI Gateway," which is what makes
BYO copilot work without a second SDK.

## 10.2 Data layer

| | Before | After |
|---|---|---|
| Postgres extensions | `vector` | `pg_trgm` |
| Vector index | HNSW/IVFFlat on `doc_chunks` | **none** |
| Search | `tsvector` + `ts_rank` (unweighted) | `tsvector` with A/B/C weights + `ts_rank_cd` + trigram fallback |
| Canonical content | `body_json` | `body_md` |
| Blob storage | **none** | **R2** |

The R2 line is the one to plan for: you currently have **no file storage at all** — no
uploads, no attachments. The Confluence import alone brings 531 attachments and 2,920 images,
so this isn't optional, and it's new surface (signed URLs, per-workspace prefixes, access
control on read).

## 10.3 Cloudflare services

Four bindings to add to `wrangler.jsonc`, which currently has only `ASSETS`, `IMAGES` and a
self-reference:

| Service | For | Notes |
|---|---|---|
| **R2** | Attachments, images, drawio exports | Required by the importer |
| **Queues** | PR ingestion, import jobs, git export | Replaces the `ctx.waitUntil` pattern properly — retries, backoff, DLQ |
| **AI Gateway** | All model calls, both directions | Caching, per-workspace cost attribution, fallback |
| **Secrets Store** | Customer BYOK model keys | So keys never land in Supabase |

All four are turn-on-and-configure rather than build.

## 10.4 Integrations

See §11 — this was wrong in the first draft and is now its own section.

## 10.5 Topology — the real change

From **one deployable** to **three**, in a pnpm workspace:

```
apps/
  web        → Next.js on Workers (OpenNext).   Humans.
  mcp        → Worker. Stateless Streamable HTTP, OAuth RS.   Agents.
  ingest     → Queue consumer Worker.   PR webhooks, imports, exports.
packages/
  db         → schema, scoped client (§2.4), merge engine callers
  markdown   → parse/serialize/round-trip gate — shared by web, mcp, ingest
  confluence → the importer
```

**Why `mcp` is its own Worker rather than a Next route:** a different auth model (OAuth
Resource Server with audience-bound tokens, not cookie sessions), a different scaling profile,
genuine statelessness under the 2026-07-28 spec, and no OpenNext bundle on an agent hot path.
It also lets you version and publish the server independently.

**The honest counterpoint:** three deployables is real ops cost, and you could start `mcp` as
a route group in `apps/web` and split it later — the DB and markdown packages make that a
mechanical move. If you're a small team shipping fast, starting merged is defensible. I'd
still split it, because the auth models genuinely differ and mixing them is how audience
validation gets skipped.

`packages/markdown` is the one that has to be shared no matter what: the editor, the MCP
server, the PR summarizer and the importer must all produce byte-identical markdown, or the
round-trip gate in §4.2 becomes meaningless.

## 10.6 What stays exactly as it is

Next.js 16 App Router · React 19 · Tiptap 3 (constrained schema only) · Tailwind 4 · Supabase
Postgres + Auth + RLS · Cloudflare Workers via OpenNext · PostHog · vitest · wrangler · pnpm.

The most accurate summary: **you're deleting a subsystem (embeddings), adding a storage layer
(R2) and a background layer (Queues), splitting one Worker into three, and changing which
column is the source of truth.** No framework migration anywhere.

---

# 11. Integrations

**Correction.** An earlier draft said "drop Composio." That was wrong — it assumed GitHub was
the only integration, which is false under a thesis where systems are one of three ways
knowledge enters. The right answer isn't a vendor choice at all. It's that **integrations
split into three purposes with three different correct answers**, and conflating them is the
mistake.

| Purpose | Direction | Right answer |
|---|---|---|
| **Records** — a merged PR becomes a page | **Push** | **Own it.** This is the product |
| **Enrichment** — "what's in the linked ticket?" | **Pull** | **Consume first-party MCP servers** |
| **Migration** — import from Confluence/Notion | One-shot | Bespoke importers |

## 11.1 The fact that decides the write path: MCP cannot push

This is the single most important finding, and it cuts against the fashionable answer.

The **2026-07-28 spec moved *further* from push**, not toward it: the core went stateless, the
`initialize` handshake and `Mcp-Session-Id` were retired, and roots/sampling/logging were
deprecated. Server-initiated work became **MRTR** — still inside a client-initiated exchange.
Tasks graduated to a stable extension but are explicitly **poll-based** (`tasks/get`).

The MCP project says the gap itself. From the **Triggers and Events Working Group charter**
(chartered 2026-03-24, led by Clare Liguori of AWS and Peter Alexander of Anthropic):

> "Today, clients learn about server-side updates by polling or holding an SSE connection
> open. This WG will specify a standardized callback mechanism—webhooks or similar—that lets
> servers push notifications when new data is available…"

Status of the deliverable SEP: **"Ideating."** The incubation repo has **one commit** and an
experimental banner. As the Slack MCP analysis puts it: *"The AI doesn't watch Slack; it waits
for you to ask."*

**So: MCP won the read path. Nothing has won the write path.** Anyone recommending you replace
connectors with MCP servers hasn't read the spec. Architect as if MCP push does not exist, and
revisit when that SEP is accepted with reference implementations in two Tier-1 SDKs.

## 11.2 Write path — Composio + a reconciler

**Decision: stay on Composio.** You have working code, dedup infrastructure
(`20260610002000_integration_webhook_pr_merge_dedupe.sql`) and an event table already. Swapping
transports buys nothing today.

The one real risk — Composio's triggers publish no delivery guarantees, retry policy, ordering
or replay — does **not** require owning the GitHub App to fix. It requires a **reconciler**,
which is a fraction of the work and closes the gap regardless of which transport you end up on.

### The reconciler

A dropped webhook should be a 15-minute delay, not a permanent hole. Every 15 minutes, per
connected repo:

```
GET /repos/{owner}/{repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50
  → keep those with merged_at within the last 24h
  → left join against documents where source_ref->>'pr_url' = html_url
  → for each miss: synthesize a KnowledgeEvent and push it through the same pipeline
```

Cost is one API call per repo per cycle — 96/day/repo against a 5,000/hr budget, i.e. nothing.
Run it as a Cloudflare Cron Trigger feeding the same Queue.

Two properties worth noting. It makes **at-least-once delivery a non-requirement** — the
pipeline is already idempotent on delivery ID, so a replayed or reconciled event is free. And
it's **transport-agnostic**: identical code whether events arrive via Composio, Nango, or your
own App. That's what makes the vendor decision genuinely reversible rather than nominally so.

Expose `last_reconciled_at` and a "PRs found by reconciler vs webhook" counter per workspace.
If the reconciler is routinely finding events, that's your data for revisiting the transport —
an actual measurement rather than my speculation about undocumented semantics.

### Ingestion pipeline (unchanged by the vendor choice)

A dropped `pull_request.closed` is a missing page, and a missing page is a silent correctness
bug nobody reports — users just quietly stop trusting the KB. That risk belongs to you.

**If you ever do own the GitHub App** — not now, but worth knowing before you commit either
way — the trap is not API rate limits. Per-installation budgets scale fine (5,000 req/hr,
15,000 on Enterprise Cloud). It's that `POST /app/installations/{id}/access_tokens` is
throttled at the **app level**, and at scale concurrent minting causes a thundering herd that
freezes the whole app. The fix is to cache installation tokens for their full one-hour life,
distributed-lock the minting, and jitter the pre-warm. Composio absorbs this problem for you
today — which is a real, underrated argument for staying put.

**Two things to watch, not act on.** Composio's pricing page currently carries a
**"pricing changing August 15th"** banner, and pricing has been repackaged at least three
times since Q3 2025 — so re-check the cost model after that date. And they're a well-funded
seed-plus company ($25M Series A, Lightspeed), not decade-old infrastructure. Neither is a
reason to move; both are reasons to keep §11.5's abstraction honest so moving stays cheap.

**Ingestion pipeline:**

```
webhook → Worker: verify HMAC over raw body (WebCrypto, constant-time) → enqueue → 200
       → Cloudflare Queue (GA; 5,000 msg/s, 250 concurrent consumers, ~60ms send)
       → consumer: fetch detail, summarize, create record, extract links
       → idempotency on X-GitHub-Delivery, unique constraint in Postgres
```

Assume at-least-once end to end — GitHub redelivers, Queues redeliver.

**Put Hookdeck in front, for $39/mo + $3.30/M events.** You're not buying queueing (Queues
gives you that) — you're buying **replay, visual event tracing, searchable history, dedup, and
160+ pre-configured sources**. When a customer asks "why didn't Tuesday's PR show up," replay
is the difference between five minutes and a day. Cheapest insurance in the stack. Svix Ingest
is the wrong tool for inbound: no durable queue, no dedup, no filtering, a rolling 6-hour
observability window, and **$490/mo**.

## 11.3 Read path — be an MCP client

At page-generation and question-answering time, when the agent needs "what's in the linked
Jira ticket / the Sentry issue / the Notion page," **connect to first-party MCP servers**
instead of building connectors. OAuth-scoped, permission-respecting, zero connector
maintenance — and the stateless 2026-07-28 transport means no session affinity to manage,
which is a genuine win on Workers specifically.

The precedent is strong: **Slack shipped Slackbot's MCP client to GA on 17 June 2026** with
20+ partners rather than building 20 more connectors.

First-party remote servers that exist today:

| Tool | Status |
|---|---|
| GitHub | `api.githubcopilot.com/mcp/`, 18 toolsets |
| Linear | **GA**, OAuth 2.1 + DCR, read-only variant available |
| Slack | **GA since Feb 2026** (workspace admin approval required) |
| Atlassian | **GA Feb 2026** — Jira, Confluence, Compass, Bitbucket |
| Notion | GA |
| Sentry, PagerDuty, Intercom | Official |

**Known gaps:** Zendesk (community only), **Google Workspace/Drive** (no first-party server),
Figma (not a first-party remote endpoint). That's exactly where a broker earns its keep — and
it's not a small gap for a knowledge base.

Note the nice side effect: **the Atlassian MCP server is GA and covers Confluence**, so during
migration you can read a customer's live Confluence for reconciliation rather than relying
only on their export.

## 11.4 The long tail — Composio now; what would change my mind

Composio covers this today and there's no reason to churn. Recording the alternative only so
the trigger for revisiting is written down rather than remembered.

**Nango is the closer structural fit on paper**, for three reasons:

- **Open source and genuinely self-hostable** (~11.3k stars). Composio's self-host is
  Enterprise-only. This is the one that matters — it caps your downside if pricing gets
  repackaged or the company is acquired, and it's consistent with Aqli being MIT and selling
  self-hosting.
- **Prices per connection**, which maps directly onto your per-customer-org tenancy: $50/mo
  for 20 connections, $500/mo for 100, +$1/connection overage.
- **Webhooks are a metered first-class primitive**, not an afterthought.
- Ships MCP anyway, like everyone now does.

Merge.dev is the wrong shape (HRIS/ATS/accounting categories, $650/mo for 10 linked accounts,
third-party webhooks gated behind Pro). Paragon is well built but custom-priced with self-host
locked to Enterprise — poor fit pre-enterprise-revenue. Pipedream Connect has the widest
catalog (3,000+ integrations) if breadth is the only goal.

**Revisit only if one of these fires:** the August repricing materially changes your unit
economics; the reconciler (§11.2) shows a persistent gap between webhook and reconciled events;
or a customer's procurement asks for a self-hosted deployment with no third-party in the data
path. Absent those, staying is correct — and §11.5 is what keeps the switch cheap if it ever
comes.

## 11.5 The abstraction that makes the vendor choice reversible

Own the normalization, not the transport. One internal interface, every source behind it:

```ts
type KnowledgeEvent = {
  id: string;              // provider delivery id — the idempotency key
  workspaceId: string;
  source: 'github' | 'slack' | 'linear' | 'pagerduty' | string;
  kind: 'pr.merged' | 'incident.resolved' | 'decision.recorded' | string;
  occurredAt: string;
  actor: { external_id: string; display: string };
  subject: { url: string; title: string; ref?: string };
  payload: unknown;        // raw, retained for replay
};

interface EventSource {
  verify(req: Request): Promise<boolean>;
  normalize(req: Request): Promise<KnowledgeEvent[]>;
}
```

Then one pipeline downstream, shared by every source:

```
KnowledgeEvent → worthiness policy → summarize (workspace's model) → record document → links
```

The **worthiness policy** is the piece with real product value and it's yours regardless of
vendor: does this event deserve a page? Default rules — only PRs touching a space's declared
`code_paths`, or carrying a `docs:` label; only incidents at SEV2+; only Slack messages
explicitly marked with a `:knowledge:` reaction. Without this you'll generate 200 pages a month
about dependency bumps and hit the dilution problem from Decision 4 within a quarter.

Adopt **CloudEvents as the internal envelope** — costs nothing, future-proofs the bus. Don't
expect to *receive* it; there's no winning inbound standard (Standard Webhooks and CloudEvents
both exist; only HTTP message signatures have real gravity, at 65%+ of implementations).

With this interface, "Composio or Nango or our own app" becomes a per-source transport choice
you can change in an afternoon. That's the actual answer to the question — not which vendor,
but making the vendor not matter.

## 11.6 Integration roadmap

**Write path (push → records)** — in order:

1. **GitHub PR merges.** Own it. This is v1 and it's the product.
2. **Incident resolution** (PagerDuty / incident.io). Highest-value record after PRs — a
   postmortem that files itself, linked to the runbook it invalidated.
3. **Slack decisions.** A `:knowledge:` reaction turns a thread into a proposal. Must be the
   **Events API** — Slack's MCP server cannot watch Slack for you.
4. **Linear cycle/project completion** → release records.

**Read path (pull → enrichment)** — as needed, all via first-party MCP:
Linear, Sentry, GitHub, Atlassian, Notion. Roughly free once you have an MCP client.

**Import (one-shot)** — this is a go-to-market surface, not plumbing:
Confluence first (§8, and you're the test case), then Notion, then Google Docs. Every one of
these is a competitor migration path, and the importer is the first thing a prospect
experiences.

**Deliberately not integrating:** anything that only *reads from* Aqli. Publishing to Slack,
embedding in Jira, browser extensions — all of that is what the MCP server is for. If someone
wants Aqli content elsewhere, they point an agent at it.
