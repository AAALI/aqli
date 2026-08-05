# Aqli, rebuilt — one architecture

August 2026. This replaces the menu of options in the review doc with a single design and
the reasoning behind each call. Where I rejected an alternative I've said so and why,
including two places where the research changed my mind from what I told you last time.

---

## 0. The thesis

**Aqli is the company knowledge base for teams where humans and agents both write.**

Not "humans write, agents read." Not "agents draft, humans approve." Both are first-class
authors in one store — a person drafting a PRD in the editor, Claude or Cursor writing a
`.md` file through MCP, and the system itself turning a merged PR into a page — all landing
in the same place, all searchable as one corpus, with provenance on every change and a
**policy, not an actor type**, deciding what needs review before it becomes trusted.

That's what makes it a Confluence replacement rather than an AI feature: a team can move
their internal docs onto it because it's a good wiki, and get an agent-native substrate
because that was the foundation rather than an integration.

Worth noting your existing tagline — *"the shared intellect for human-agent teams"* — is
already this thesis. The positioning was ahead of the architecture; this design catches the
architecture up.

**Three sources of knowledge, one store:**

| Source | How it writes | Example |
|---|---|---|
| **People** | The editor | A PRD, an onboarding guide, a compliance policy |
| **Agents** | MCP `propose_change` | Claude updating a runbook after fixing an incident |
| **Systems** | Webhooks + reconciler | A merged PR becoming a page; a resolved incident |

**Two natures, and this distinction does real work:**

- **Canon** — living documents. Policies, architecture, runbooks, guides. Mutable, owned,
  can go stale, needs periodic review.
- **Record** — immutable events. PR merges, incidents, releases, decisions. Timestamped,
  never "stale" because they're history, auto-generated, and — critically — **scoped out of
  default retrieval** (Decision 4).

Confluence conflates these, which is why Confluence spaces rot: everything is a page and
nothing knows whether it's still true. Separating them is most of the reason this can be
better rather than just newer.

Three consequences drive the design:

1. **If diffs are how humans and agents review each other's work, the source of truth must
   be diffable.** Markdown, not ProseMirror JSON.
2. **Every change is auditable and attributable, but not every change needs a human gate.**
   Review is a per-space policy, not a punishment for being an agent.
3. **Auto-generated pages must not be allowed to drown the human-written ones.** This is the
   single biggest risk the new thesis introduces, and it's addressed in Decision 4.

---

## 1. The architecture

```
  Humans ──────────────▶┌───────────────────────────────────────┐
  Next.js editor        │                                       │
                        │  proposals ──▶ policy ──▶ revisions    │
  Agents ──────────────▶│     (every write goes through here)    │
  Claude / Cursor       │                    │                   │
  via MCP server        │                    ▼                   │
                        │        documents (canon)               │
  Systems ─────────────▶│        records   (events)              │
  webhooks → Queue      │                                       │
  + 15-min reconciler   │   Postgres · markdown canonical        │
                        │   tsvector + pg_trgm                   │
                        └───────┬───────────────────┬───────────┘
                                │                   │
              ┌─────────────────▼──────┐  ┌─────────▼────────────────┐
              │  MCP client            │  │  AI Gateway → workspace's │
              │  Linear · Sentry · etc │  │  own model (BYO copilot)  │
              │  (enrichment, pull)    │  │  keys in Secrets Store    │
              └────────────────────────┘  └──────────────────────────┘
```

One write path, three sources feeding it, and MCP running in both directions — server for
agents reading Aqli, client for Aqli reading everything else. No vector database, no embedding
pipeline, no CRDT server, no sync engine. Each of those absences is a decision, argued below.

---

## 2. The eight decisions

### Decision 1 — Markdown is the source of truth. ProseMirror JSON is a derived cache.

Today `body_json` is canonical and `body_md` is regenerated from it. Invert that.

**Why.** Your review gate shows a human what an agent changed. A ProseMirror JSON diff is
unreadable; a markdown diff is the thing every engineer already knows how to review. Agents
read and write markdown natively and read PM JSON badly. `grep` works on markdown, which
turns out to matter a lot (Decision 2). Export and portability become free rather than a
feature. And there's now a standard shape for this: Google Cloud's **Open Knowledge Format**
(v0.1, June 2026) is markdown files with YAML frontmatter, explicitly designed for agents to
read *and update*, explicitly not a RAG format. Writing your export in OKF shape costs
nothing and buys interoperability.

**The cost, stated plainly:** you must constrain the editor schema to a markdown-serializable
subset — headings, lists, code blocks, tables, links, quotes, callouts. No arbitrary custom
nodes. For a technical wiki that's not a real limitation. If you ever want Figma-grade rich
content, this decision is wrong; for RFCs, runbooks and ADRs it's right.

**Rejected:** PM JSON canonical with a markdown projection. It's the safer general answer and
it's what I'd pick for a general-purpose editor — but it makes your central feature (review
a diff) permanently worse, and it makes agent writes a lossy conversion in both directions.

**Also rejected: git as the write path.** Tempting, since the review gate *is* a pull request.
But the failure catalogue is brutal and well documented — every package ecosystem that used
git as a database eventually replaced it with HTTP/CDN (Cargo's sparse registry, Homebrew's
JSON, CocoaPods CDN, the Go module proxy). Homebrew users were pulling 331 MB to update;
GitHub asked them to stop shallow-cloning. Add second-scale commit latency, merge conflicts
surfacing to non-technical users, no per-paragraph permissions, and one-repo-per-tenant
multi-tenancy, and it's clearly wrong for the write path. **Git on the export path: yes.**
Push an OKF-shaped bundle to a per-workspace repo on a schedule, one-way. You get history,
grep, PR review of exports and portability without putting git in the request path.

### Decision 2 — Lexical search first. No vector database in v1.

This is the reversal. Last time I designed you a pluggable embedding layer with dimension
standardization and shadow-index migrations. The research says that's solving a problem you
don't have yet, and possibly one you shouldn't create.

**The evidence, in the order that convinced me:**

- **BM25 beats dense retrieval outright on domain-specific documents.** On a 7,318-document
  financial corpus with ~920-token docs — structurally close to yours — recall@5 was BM25
  **0.644** vs dense `text-embedding-3-large` **0.587** (p<0.001). Hybrid+rerank reached
  0.816. Embeddings alone were the *worst* single option.
- **Dense embeddings systematically fail on exactly your content type.** Rare tokens get
  averaged away: error codes, control IDs, function names, regulation citations, version
  strings. This is the documented weak spot of dense retrieval and the documented strength
  of BM25. Technical and compliance docs are the worst case for embeddings.
- **Naive vector RAG measurably degrades at your exact scale.** A production system going
  from 54 to 1,128 heterogeneous documents dropped accuracy from **75% to under 40%** —
  *with hybrid retrieval already enabled*. You're at ~1,500. The fix that worked was
  metadata-based domain scoping, which is exactly what an agent does when it lists a
  directory and searches within a subtree.
- **You need a lexical index anyway.** Search-as-you-type needs tens of milliseconds; no
  LLM turn can serve a keystroke. Once you've built it for humans, **the marginal cost of
  exposing it to agents is zero** — which dissolves the whole "but you need embeddings for
  semantic search" argument at this scale.
- **Anthropic removed RAG from Claude Code** and uses grep + read. Their stated reasons are
  staleness, operational complexity, and the security liability of a second copy of your
  content. Vercel published the same conclusion for knowledge agents in March 2026 —
  grep/find over a synced snapshot, cost per query down ~4× *with quality up*, motivated by
  debuggability: with vectors "the agent confidently returns the wrong chunk, and you can't
  trace the path from question to answer."

**So: Postgres `tsvector` + `pg_trgm` for typo tolerance.** At 1,500 docs this is fast,
free, and needs no new infrastructure. Humans get instant search. Agents get the same index
as a tool, plus navigation tools so they can reformulate — an agent that can search, list,
grep and read does in three cheap turns what one embedding was meant to do in one.

**The honest counter-case, because it's real.** Cursor's controlled A/B found semantic
search worth **+12.5% accuracy**, with the benefit concentrating in large codebases
(+2.6% retention above 1,000 files) — and their conclusion is explicitly hybrid, grep *and*
semantic together. Vocabulary mismatch is genuinely unsolvable lexically: someone asking
"how long do we keep customer data" will not match a doc titled "Retention Schedule —
Article 17 Erasure." And GitHub Copilot *added* semantic indexing in March 2026. The
traffic is two-way; anyone telling you embeddings are simply over is overselling it.

**So make it a measured decision, with the trigger written down now:** build an eval set of
~50 real queries including deliberately paraphrased ones. **Add hybrid retrieval when
recall@10 on the lexical index falls below ~85% *and* the failures cluster in genuine
vocabulary mismatch rather than in badly-titled documents.** At 1,500 docs the more likely
diagnosis is the latter — and fixing titles, headings and frontmatter is cheaper, helps the
human UI too, and improves agent navigation.

**When you do add it**, the shape is settled and you don't need my earlier abstraction:
hybrid over the *existing* index with RRF at k=60, weighted toward lexical (~0.7/0.3 for
technical docs), then rerank a top-50 shortlist down to 5–10. Never rerank the whole
corpus — one study found recall dropping *below* the standalone retriever in ~50% of
configurations as K grew, from "phantom hits." And prefer a contextualized-chunk embedding
model (voyage-context-4, $0.12/1M, auto-chunking) over building Anthropic-style contextual
retrieval yourself at $1.02/1M in LLM preprocessing.

**What this deletes from the current design:** the embedding provider abstraction, the
dimension-standardization problem, `index_generation` shadow migrations, the re-embed queue,
chunking strategy, `doc_chunks`, the pgvector index, and the entire class of bugs where the
index silently drifts from the documents. That's most of Part 2 and Part 3 of the review
doc, gone — not fixed, *unnecessary*.

### Decision 3 — One write path for everyone. Policy, not actor type, decides what merges instantly.

This is the decision the new thesis changes most. Three tables:

- `documents` — current state. **Only a merge writes here.**
- `revisions` — immutable, append-only history. One row per merged change.
- `proposals` — a suggested change against a base revision. **Everyone writes here first:**
  people, agents, and the PR ingester alike.

Nobody — human or agent — writes to `documents` directly. What differs is whether a proposal
merges instantly or waits for a human, and that's decided by **space policy**:

| `space.review_policy` | Behaviour | Fits |
|---|---|---|
| `open` | Everything auto-merges. Feels exactly like Notion. | Team notes, drafts, scratch spaces |
| `review_agents` | People auto-merge; agent proposals queue. | Engineering docs, runbooks |
| `review_all` | Everything queues, whoever wrote it. | Compliance, policies, anything audited |

Plus a per-key override: an agent key can hold a `write` scope that lets it auto-merge in
`review_agents` spaces — that's how you promote an agent you've come to trust without
weakening the whole space.

**Why this is better than my previous version.** Making agents structurally second-class
was right when the thesis was "agents are untrusted contributors." Under the new thesis it's
wrong twice over: it makes agents permanent guests in a system meant to treat them as
colleagues, and it makes *humans* jump through a review queue to fix a typo, which is the
fastest way to lose a Confluence migration. The uniform write path keeps what actually
mattered — every change is attributable, reversible, and diffable, and `documents` has
exactly one writer — while letting each team choose its own governance.

The structural guarantee survives where it counts: in a `review_all` space, no scope and no
actor type can bypass the queue, because merging is a distinct operation from proposing.

**Provenance: accountability and disclosure are different fields.** There's an emerging
convention here worth following — the Linux kernel and Fedora both use `Assisted-by:` for AI
involvement rather than `Co-authored-by:`, on the reasoning that co-authorship denotes *human
credit* while AI involvement is *disclosure*. Adopt the same split:

- `author_id` — the accountable party. A person, or an agent key that has a named human
  owner. Someone is always answerable for a change.
- `assisted_by[]` — which agents or tools contributed. Disclosure, not credit.

This matters because the binary is false in practice. A human writing with Cursor's help, an
agent draft a human then edited, a PR page generated by a model and corrected by its author —
none of these are cleanly "human-written" or "agent-written." A flat `author_type` enum would
force you to lie about the most common case. And when an agent later retrieves that doc, the
useful signal isn't "was a machine involved" — it's "who is accountable, and has a human
looked at it."

Conflict handling comes free: a proposal carries `base_revision_id`, so if the document moved
on you detect it and show a rebase, exactly like a PR.

### Decision 4 — Records are indexed but scoped out of default retrieval.

PR-merge pages are the most interesting part of the new thesis and the most dangerous. Both,
for the same reason: volume.

A moderately active team merges 50–200 PRs a month. Within a year that's 1,000–2,000
auto-generated pages sitting alongside a few hundred human-written ones. And the
best-evidenced finding in all my research is exactly this failure: a production system going
from 54 to 1,128 heterogeneous documents dropped retrieval accuracy **from 75% to under 40%**.
The fix that worked wasn't better retrieval — it was **domain scoping**, restricting search to
a relevant subtree, which cut effective search space 85–98% and lifted precision@10 from 0.77
to 0.86.

So: PR pages are not documents in the same pool. They're `record`-class, and:

- **Excluded from default `search_docs`.** An agent asking "how does auth work" gets your
  architecture doc, not forty PR summaries that touched auth.
- **Reachable explicitly** via `search_records` or `search_docs(include: ["record"])`, which
  is what you want for "why did we change X" and "when did this ship."
- **Linked from canon, not merged into it.** A PR page that touches the auth service shows up
  as a backlink on the auth doc. That's the high-value connection — "this doc has 12 changes
  behind it since it was last reviewed" is a *staleness signal*, and it's a genuinely better
  answer than the 90-day timer you have today.
- **Never stale.** A record is history; it can't be out of date. Only canon needs review
  timers. Applying one lifecycle to both is what makes wikis rot.

**Also worth knowing competitively:** most tools in this space (Ferndesk, Swimm, Mintlify)
*update existing docs* from PR activity rather than creating a page per PR. Your instinct to
give merges their own page is the more differentiated call and I think the better one — a
record of what happened is verifiable, whereas auto-editing someone's policy doc is exactly
the trust problem your review gate exists to solve. But it only works if records stay in
their own lane. Get this wrong and you'll have built a very good search index over mostly
noise.

The natural follow-on, once records exist: the highest-value thing an agent can do is not
write a PR page at all — it's notice that a merge contradicts a canon doc and open a
proposal against it. That's the loop the whole design is for, and records are what make it
possible.

### Decision 5 — Server-authoritative editing. No CRDT.

One writer at a time per document, with presence ("Ali is editing") and section-level
awareness. Optimistic local state, server is the arbiter.

**Why.** A permissioned team wiki is server-authoritative by definition — you already need
the server for authorization on every write. The strongest published critique of Yjs makes
exactly this point: CRDTs buy you conflict-free merges you don't need when a server is
already deciding, while costing you schema authority (an invalid node deleted by one peer
propagates the deletion to everyone), position-mapping breakage on rich-text plugins,
tombstone growth, and debugging that's an order of magnitude harder. And the honest
observation about wikis: **simultaneous editing of the same document is rare.** Confluence
barely supports it well; most teams never hit it.

**Rejected:** Yjs + Hocuspocus, or Durable Objects + `y-partyserver`. Both are perfectly good
and I'd choose Yjs for a Google-Docs competitor. For a review-gated wiki they add a
stateful real-time server, a persistence story (`y-partyserver` doesn't even use DO SQLite
for the ydoc — you implement `onLoad`/`onSave` against R2), and a second source of truth
that fights Decision 1. If concurrent editing becomes a real complaint, add it then, scoped
to the editor only.

Also: get Tiptap's self-hosted commercial licensing clarified in writing before depending on
their collaboration extensions — the community question has sat unanswered since December
2025.

### Decision 6 — No sync engine. Server Actions + `useOptimistic`.

**Why.** The clunkiness is real but the cause is `router.refresh()` on the hot path of every
mutation, not the absence of a sync engine. The correct fix is optimistic UI: Server Actions
with `useOptimistic` for point mutations, plus `loading.tsx` boundaries so prefetch works at
all.

**Rejected: Zero (Rocicorp).** It hit 1.0 in June 2026 with real production users and it's
the strongest candidate — but **it doesn't support SSR** and ships a 232 KB gzipped client.
"No SSR" is a direct architectural conflict with Next.js App Router. Revisit if that lands.

**Rejected: Electric + TanStack DB.** Electric is read-path only, so writes still go through
your API — meaning it doesn't remove the round trip by itself, and TanStack DB is still 0.x.

**The general rule from the local-first literature applies squarely here:** don't go
local-first for permissioned CRUD without offline requirements, because **authorization is
the hardest problem in local-first** — and a permissioned multi-tenant wiki is precisely
that shape. If you later want headroom, TanStack DB's `queryCollection` layers over your
existing endpoints collection-by-collection, no rewrite.

### Decision 7 — MCP in both directions. Webhooks inbound for writes.

The organising principle for every external connection:

| | Protocol | Why |
|---|---|---|
| Agents **read** Aqli | MCP **server** | Universal, model-selectable, stateless |
| Aqli **reads** other tools | MCP **client** | First-party servers exist; zero connector maintenance |
| Systems **write** to Aqli | **Webhooks** + a reconciler | **MCP structurally cannot push** |

That last row is the constraint that shapes everything, and it's easy to get wrong because
"just use MCP for integrations" sounds right in 2026. It isn't. The 2026-07-28 spec moved
*further* from push — stateless core, `initialize` handshake retired, roots/sampling/logging
deprecated, Tasks explicitly poll-based. The MCP project's own **Triggers and Events Working
Group** (chartered March 2026, led by AWS and Anthropic) exists to close exactly this gap, and
its deliverable SEP is still status *"Ideating"* with one commit in the incubation repo.
**MCP won the read path; nothing has won the write path.** Architect as though MCP push does
not exist.

**As an MCP client**, Aqli pulls enrichment at page-generation and question-answering time —
what's in the linked ticket, what the Sentry issue says — against first-party servers that are
already GA: GitHub, Linear, Slack (Feb 2026), Atlassian (Feb 2026, covers Confluence), Notion,
Sentry, PagerDuty, Intercom. Slack shipped an MCP client of its own in June 2026 rather than
build twenty more connectors, which is the precedent. Real gaps: Zendesk, Google Workspace and
Figma have no first-party servers — that's the long tail where a broker (Composio, today)
earns its keep.

**As an MCP server**, five tools. Stateless Streamable HTTP against spec **2026-07-28**, on
Workers via `createMcpHandler`.

| Tool | Returns |
|---|---|
| `search_docs` | Ranked snippets + doc IDs + headings. Paginated, filterable by space/type/status. |
| `read_doc` | Full markdown, with offset/limit for progressive disclosure. |
| `grep_docs` | Regex within a doc or subtree — exact identifiers, clause lookup, verification. |
| `list_docs` | The tree: spaces, titles, frontmatter. **This is the agent's domain scoping.** |
| `propose_change` | Opens a proposal. Returns "pending human review," never "done." |

Deliberately **no `approve` tool.** The human gate is the product; exposing it to agents
would be incoherent.

**Why tools and not resources.** Resource support is shallow outside VS Code — only VS Code
implements resource *templates*, *subscribe*, and `list_changed`, and templates are exactly
what a parameterized document space needs. Tools are the only universally supported,
*model-selectable* primitive. A flat list of 1,500 resources is also a context bomb. Google
shipped its own Developer Knowledge MCP server this way — search returns snippets, a second
call fetches full markdown — and they had every incentive to use resources. Do expose a
handful (5–30) of canonical docs as resources: glossary, architecture overview, the index.

**Design notes that matter more than they look.** Keep the tool count small and invest
heavily in the server `instructions` field — with Claude Code's tool search on by default,
that text is what makes Claude decide to search your server at all. Consolidate around
workflows, not your data model. Add a `response_format: concise | detailed` parameter.
Paginate and truncate by default; Claude Code caps tool responses around 25k tokens.

**Don't build on roots, sampling, or logging** — all three were deprecated in SEP-2577 for
low adoption. Note the 2026-07-28 core is *stateless*: no `Mcp-Session-Id`, no `initialize`
handshake, state via server-minted opaque handles. That's a gift — it means the MCP server
is a plain stateless Worker behind a load balancer.

**Auth: OAuth 2.1 Resource Server, never an Authorization Server.** RFC 8707 audience-bound
tokens validated on every request; RFC 9728 discovery; RFC 8693 token exchange for
downstream calls — never passthrough. Client ID Metadata Documents, not Dynamic Client
Registration (formally deprecated). Workspace identity comes from a verified token claim,
never from a tool argument.

### Decision 8 — BYO copilot per workspace, through AI Gateway. Keys never touch your database.

This half of "unbundle the AI" survives intact, because generation is stateless: a workspace
can switch models between two requests and nothing needs migrating.

`workspace_ai_config` holds provider, model, an optional copilot system prompt, a token
budget — and a **`byok_alias`**, not a key. The actual credential lives in Cloudflare Secrets
Store, referenced by `cf-aig-byok-alias`. You get caching, per-workspace cost attribution
via `cf-aig-metadata`, rate limiting, and fallback for free. **"We never hold your model
keys" is a claim worth designing for on day one** — retrofitting key custody is painful, and
for a product selling to regulated teams it removes a whole class of breach liability.

The copilot system prompt is a small feature with outsized value: it's how a team makes the
assistant sound like their team.

---

## 3. Data model

```sql
workspaces      (id, slug, name)
members         (workspace_id, user_id, role)
spaces          (id, workspace_id, slug, name,
                 review_policy)              -- open | review_agents | review_all

documents       (id, workspace_id, space_id, slug, title,
                 doc_class,                  -- canon | record
                 origin,                     -- human | agent | system
                 source_ref jsonb,           -- PR url, commit sha, incident id (records)
                 frontmatter jsonb,          -- OKF-shaped: type, owner, tags, effective_date
                 body_md text,               -- canonical
                 current_revision_id,
                 search_vector tsvector,     -- generated, GIN indexed
                 last_reviewed_at)           -- canon only; records are never stale

revisions       (id, document_id, body_md, title, frontmatter,
                 author_id,                  -- accountable: person, or agent key's owner
                 assisted_by text[],         -- disclosure: which agents/tools contributed
                 agent_key_id, parent_revision_id, created_at)   -- append-only

proposals       (id, document_id NULL,       -- NULL = proposed new doc
                 workspace_id, space_id, base_revision_id,
                 title, body_md, frontmatter, rationale,
                 author_id, assisted_by text[], agent_key_id,
                 state,                      -- open | merged | rejected | superseded
                 auto_merged bool,
                 review_note, reviewed_by, reviewed_at)

document_links  (from_document_id, to_document_id, kind)   -- record→canon backlinks

agent_keys      (id, workspace_id, name, hash, owner_user_id,
                 scopes[],                   -- read | propose | write
                 last_used_at)
workspace_ai_config (workspace_id, provider, model, byok_alias,
                     copilot_system_prompt, monthly_token_budget)
audit_log       (workspace_id, actor_type, actor_id, action, target, at)
```

Eleven tables. RLS on every one, keyed on workspace membership.

Four things worth pointing at:

- **`agent_keys.owner_user_id` is not optional.** Every agent key belongs to a person, so
  every change has an accountable human even when a machine wrote it. That's what makes
  `author_id` meaningful across both sources.
- **`assisted_by` is an array, not a flag.** A doc drafted by Claude, edited by a person, and
  fact-checked by another agent records all three. A boolean `is_ai` would be a lie in the
  most common case.
- **`doc_class` is the retrieval boundary.** `search_docs` filters to `canon` unless asked
  otherwise. This one column is what stops 2,000 PR pages from burying 300 real ones.
- **`last_reviewed_at` applies only to canon.** Staleness for records is a category error.

Gone from the old design: `doc_chunks`, embeddings, `body_json` as canonical, and `status` as
a trust boundary. Trust is now "is there a merged revision, and who's accountable for it" —
facts, not a flag.

---

## 4. What v1 deliberately does not have

The discipline list. Each of these is a real feature that a real user will ask for, and each
one is correctly deferred:

- **No vector search.** Decision 2. Ship the eval set instead, and let it tell you.
- **No real-time collaborative editing.** Presence and one-writer-at-a-time.
- **No sync engine.** Optimistic UI covers the complaint.
- **No git write path.** Scheduled one-way OKF export.
- **Integrations: GitHub for writes, MCP client for reads.** This changed with the thesis.
  PR ingestion is a primary content source now, not surface area, so the GitHub path is core:
  webhook → Queue → agent summarizes the diff → `record` document → backlinks to whatever
  canon it touches, with a 15-minute reconciler so a dropped webhook is a delay rather than a
  permanently missing page. Composio stays as the transport — it works, and the reconciler
  makes its delivery semantics a non-issue. Slack decisions and incident ingestion wait for
  v2; enrichment reads come free via the MCP client.
- **No AI features beyond the copilot and search.** Today there are six `/api/ai/*` routes —
  summary, ask, related, rewrite, cowrite, consistency. Ship *ask* and *cowrite*. The
  others are features looking for a user.
- **No spaces hierarchy beyond one level.** Flat spaces with tags will hold to 5,000 docs.

**One thing the new thesis adds to v1: a Confluence importer.** If the pitch is "replace your
internal docs," the migration is the product's first impression, and you have the ideal test
case sitting in a zip — 1,361 pages, 531 attachments, 611 comments. Storage-format XHTML →
markdown, attachments to R2, page tree to spaces, cross-links rewritten. It's a few days, it
makes the demo self-evident, and it forces the markdown-canonical decision to actually hold
up against real-world content rather than clean test data.

Rough count: on the order of 15–18 API routes against today's 39, and roughly half the
current code, doing the important part better.

---

## 5. Build order

**Week 1 — the spine.** Schema with RLS. Markdown-canonical documents, revisions, proposals,
and the **merge policy engine** — the function that takes a proposal plus a space policy plus
an actor's scopes and decides merge-now or queue. Merging is one transaction. No UI yet;
prove the loop with SQL and tests. This is the product; get it right before anything renders.

**Week 2 — the human surface.** Next.js App Router. Editor constrained to a
markdown-serializable schema, autosave writing markdown. `loading.tsx` boundaries, Server
Actions, `useOptimistic` — the clunkiness fix is architectural here, not a later cleanup.
Review queue showing a real markdown diff, with provenance on every entry. `tsvector` +
`pg_trgm` search-as-you-type. **The Confluence importer** — it's the fastest way to get real
content in and stress the markdown decision.

**Week 3 — the agent surface.** MCP server, five tools, stateless Streamable HTTP on
Workers. OAuth 2.1 resource server with audience-bound tokens. Scoped agent keys with human
owners. Ship `@aqli/mcp` on npm so setup is one line in a Claude or Cursor config — that
snippet is what makes people try it.

**Week 4 — records.** GitHub webhook (via Composio, which you already have) → Queue → agent
summarizes the merge → `record` document → backlinks to the canon it touches. The 15-minute
reconciler, which makes at-least-once delivery a non-requirement and is a fraction of the work
of owning a GitHub App. Retrieval scoping so records stay out of default search. And the
"12 merges since this doc was last reviewed" staleness signal on canon pages — that's the
feature that will sell this, because it's the thing Confluence structurally cannot do.

Behind all of it, one `KnowledgeEvent` interface that every source normalizes into, so the
transport is a per-source choice you can change in an afternoon rather than an architectural
bet.

**Week 5 — copilot and export.** AI Gateway with BYOK, `workspace_ai_config`, ask + cowrite.
Scheduled OKF git export. **The eval set** — 50 real queries, graded, checked into the repo,
run against canon-only and canon+records so you can see what records do to precision.

Then stop and use it for a month before adding anything. The eval set tells you whether
Decision 2 was right and whether Decision 4's scoping is tight enough, and that's the only
honest way to find out.

---

## 6. Getting there from where you are

You don't rewrite. Three of the four weeks above are re-sequencing work you'd do anyway:

1. **Flip the source of truth.** Backfill `body_md` from `body_json` once, then make markdown
   canonical and PM JSON derived. One migration.
2. **Add `proposals`, remove agent write access to `docs`.** This fixes the trust-boundary
   bug by construction rather than by check.
3. **Turn off embeddings.** Keep `doc_chunks` around for a month behind a flag; put the eval
   set against tsvector and compare. If lexical holds, drop the table — and with it the
   `ctx.waitUntil` bug, the missing-schema problem, the chunker issues and the re-embed
   cost, all at once.
4. **Add `loading.tsx` and `useOptimistic`** — half a day, unrelated to everything else, and
   the biggest thing users will notice.
5. **Then** the MCP server and BYO copilot.

Step 3 is the one that requires nerve. It also deletes more code and more bugs than
everything else combined.

---

## 7. Where I'd change my mind

Stating this properly, because the confident version of this document would be dishonest.

- **The single benchmark closest to your scale favours RAG.** At 1,000 documents, vector
  retrieval matched a filesystem agent on quality (correctness 8.2 vs 7.9, identical
  relevance) and was **4× faster** — 2.1s vs 8.3s. It comes from a RAG vendor, but it's the
  most directly applicable number I found, and it argues the agentic advantage is thinning
  right where you sit.
- **Tool-result *formatting* flipped grep-vs-vector rankings in 5 of 10 configurations** in
  the most rigorous head-to-head study. That's a warning that all of these results are less
  stable than any single blog post implies — including this document.
- **If a meaningful share of your content is Arabic, or your users query conceptually rather
  than by identifier**, the vocabulary-mismatch argument gets much stronger and I'd add
  hybrid retrieval sooner. Lexical-first assumes identifier-heavy technical prose, which is
  what your Confluence export looks like — but your users aren't only engineers.
- **If concurrent editing turns out to be common**, Decision 5 is wrong and you want Yjs.
  Watch for it rather than assuming either way.
- **Records are the highest-variance bet in the design.** If PR pages turn out to be read by
  nobody, they're a large, growing, expensive-to-generate corpus that exists to dilute your
  index — and the honest move is to kill them and keep only the backlink signal (which is
  where most of the value probably lives anyway). Instrument it from day one: what fraction
  of `search_records` calls happen, and does anyone open a record page twice? Decide on data
  at the three-month mark rather than on how good the idea sounds now.
- **Staying on Composio is a measured bet, not a settled one.** Their triggers publish no
  delivery guarantees, retry policy, ordering or replay — which is why the reconciler exists
  rather than a vendor swap. Instrument "events found by reconciler vs by webhook" per
  workspace from day one. If that ratio stays near zero, the concern was mine and not real. If
  it doesn't, you'll have data instead of my speculation. Two other things to watch rather than
  act on: their pricing changes 15 August and has been repackaged three times since Q3 2025,
  and they're a well-funded seed-plus company rather than decade-old infrastructure.
- **`review_agents` as the default space policy is a guess.** It might be that teams want
  `open` everywhere and only turn on review after an agent embarrasses them once. That's
  worth watching, because if true, the review queue is a compliance feature rather than the
  core loop — which would be a real shift in what the product is.

The reassuring part: **the recommended path is a strict prerequisite for the alternative.**
Lexical index + agent navigation is exactly what hybrid retrieval is built on top of, and
markdown-canonical storage is what makes any retrieval strategy easy to re-index. You cannot
build the wrong thing first. That's the main reason I'd start here rather than hedging.
