# Adoption — what has to be true before a company can switch to Aqli

> **What this is.** The features that decide whether a whole company can move
> its documentation onto Aqli and turn the old wiki off — written as
> requirements with acceptance criteria a reviewer can check. It came out of a
> real adoption review; everything specific to that company has been
> generalized, because none of it was actually specific to them.
>
> **What this is not.** `ROADMAP.md` is the product direction and the ordering
> argument. This file is narrower: for each adoption blocker, what "done" means.
> And it is not a migration playbook — `docs/moving-from-confluence.md`, which
> ships alongside the MCP server, is that: written for the person running a
> move rather than the person building.

Each item below splits into **Build** (product work, in this repo) and **Run**
(what an adopting team does with it). The split matters: the same requirement
looks like a feature to us and a checklist item to them, and an adoption doc
that blurs the two ends up describing one customer's week instead of a product.

Steps marked 🔐 need production credentials or a provider console. Agents cannot
do them; an operator has to. Every install has its own 🔐 list, which is why the
build work below is mostly about shrinking it.

---

## The switch test

A company can retire its old wiki when all six are true. They are the same six
for everyone, and each maps to a feature below.

| # | The customer can say | Feature |
|---|---|---|
| 1 | Every page a team still uses is in Aqli, in the right space, images intact, tree preserved. | F-1, F-3 |
| 2 | Everyone has an account, and teams with sensitive content have spaces only their members can read. | F-4, F-5 |
| 3 | A non-technical teammate can find, read, edit, illustrate, comment and @mention — without instructions. | F-5 |
| 4 | Their AI assistants read approved docs and draft new ones into the review queue, attributed to the person who asked. | F-2 |
| 5 | Every change leaves a revision a human can view and revert from; agent content never becomes trusted context without approval. | F-0 |
| 6 | An admin can produce a full markdown + images export on demand. | F-6 |

Gate 6 is the one that makes the other five safe to commit to. A company that
cannot leave has not chosen us; it has been captured by us, and it can feel the
difference during the evaluation.

---

## Invariants

Adoption work does not get to bend these. They are what the product is.

| # | Invariant | Enforced by |
|---|---|---|
| C1 | `body_md` is canonical; `body_json` is a derived cache. The markdown allowlist stays small — a new node type needs a round-trip test proving **preservation**, not just stability. | `lib/markdown/schema.ts`, round-trip gate, eslint single-schema rule |
| C2 | Every write is a proposal; space `review_policy` + key scopes decide merge-vs-queue. The review trail in `doc_comments` is undeletable and unforgeable. | `app.submit_proposal`, `app.decide_disposition`, `lib/merge/disposition.ts` |
| C3 | RLS-first tenancy. New tables ship with policies **and** a tenant-boundary test in `supabase/tests/`. Service-role access only via `lib/db` `scoped()`. | migrations, `lib/db/scoped.ts`, eslint `no-restricted-imports` |
| C4 | On the Cloudflare Workers free plan the bundle stays under **3,072 KiB gzipped** (~2,400 KiB today, drifting up). Editor-class code loads via `next/dynamic` `ssr: false`. Measure with `npx opennextjs-cloudflare build && npx wrangler deploy --dry-run`. | `reports/HANDOVER.md` §3 |
| C5 | Agent keys carry an accountable `owner_user_id` and scopes (`read` always; `propose` default; `write` exceptional) — who acted, on whose behalf, per action. | `lib/api-keys.ts`, `lib/agent-scopes.ts` |

---

## F-0 — Install integrity

**Status: shipped, except the one-way-door sequence for instances that predate
it.**

**Why every customer needs it:** an instance can be running, serving pages, and
still be missing the migration that puts RLS on comments or the flip that makes
markdown canonical. Today the only way to know is to read `reports/HANDOVER.md`
and run SQL by hand. That is fine for the people who wrote it and a trap for
everyone else — and a self-hoster who trips it does not get a support ticket,
they get a silent data-exposure bug.

### Build

- **A preflight command and an admin health view** reporting, per instance:
  migrations present in the repo but not applied; any `public` table with RLS
  disabled; `app.migration_gates` rows; merge-engine state; storage bucket and
  its policies; whether email confirmation is on; embedding key present. Green
  or a named fix — never a number the reader has to interpret.
  *Shipped: `pnpm preflight` and Settings → Health. The checks live in
  `app.preflight` (a database function, so the CLI and the page cannot drift
  apart) and are rendered by `lib/preflight`. Two things a database cannot see
  about itself are added by the caller: the deployment's environment variables,
  and GoTrue's `mailer_autoconfirm` — the setting the README tells you to
  disable for local development and which nobody remembers to reverse. The
  report also counts approved documents with no embeddings, because an instance
  that answers nothing looks perfectly healthy from the outside.*
- **One-way doors gate themselves in code.** Any migration that depends on a
  script having run refuses to apply without its `app.migration_gates` row, as
  `20260805040000_body_md_canonical.sql` already does. Runbook prose is not a
  guard; the database is.
- **Fresh installs land in the end state.** A new instance should never walk the
  flag sequence — canonical markdown and the merge engine are simply on. The
  sequence exists only for instances that predate them.
  *Half shipped. The trap was worse than "walk the sequence": the canonical
  migration refused to apply without the backfill gate, so the last file in the
  folder failed on **every** new install, telling the operator to run a script
  that would have processed zero rows. It now records the gate itself when
  there are no documents to back-fill, saying who recorded it and why, and the
  SQL suite proves the chain replays with no manual SQL. What is still ahead is
  the merge-engine flag sequence for instances that predate it.*
- **The `body_md` backfill is a supported operation,** not a migration artefact:
  documented, dry-run-first, gated per document, and reporting to
  `reports/markdown-backfill.md`. Any instance whose markdown was written by the
  old converter needs it, not just the first one.

### Run

🔐 Apply every migration, run the preflight, read it, fix what it names. If the
instance predates markdown-canonical, follow the deploy order in
`reports/HANDOVER.md` §"Deploy order": migrations → `AQLI_MERGE_ENGINE=0` →
flip to `1` → watch proposals for a day → backfill → canonical migration → drop
the flag.

### Acceptance

- [x] Fresh clone → apply every migration with no manual SQL. `supabase/tests/run.sh` replays the whole folder against an empty database and no longer hands the canonical migration its gate.
- [x] An instance missing `doc_comments` RLS fails preflight and is told exactly which migration closes it — by filename, resolved from the checked-in migration list.
- [x] The canonical migration refuses to apply without its gate row when documents exist (`supabase/tests/canonical_flip.sql`, sections 2 and 2b).
- [x] A backfill that skips any document does **not** record its gate (`scripts/backfill-markdown.ts` records only on a clean apply).
- [ ] Preflight green against a real Supabase project — needs a service key, so it is an operator step.
- [ ] Editing a doc writes a `revisions` row; History shows it and can revert from it.

---

## F-1 — Import

**Status: shipped for markdown/zip and Confluence. Notion is a third adapter,
not a second pipeline.**

**Why every customer needs it:** nobody re-types their handbook. This is the
single largest reason an evaluation ends without a switch, and it is the same
work for every source — only the parser at the front changes.

### Build

- **A source adapter contract**, so sources are cheap: each adapter yields
  pages with `{ source_id, title, body, parent_source_id, attachments, author,
  timestamps, labels }`. Ship markdown/zip first (cheapest, also serves
  engineering exports), then Confluence space export, then Notion. The
  converter (`lib/confluence/storage-to-md.ts`) and the fidelity gate
  (`scripts/confluence-fidelity.ts`) already exist behind that contract.
  *Shipped: `lib/import/types.ts` is the contract, with `sources/markdown-zip.ts`
  and `sources/confluence.ts` behind it. The Confluence adapter detects its
  column names rather than assuming one version's CSV layout, and says which it
  found — "why is my tree flat?" is answerable without reading the code. Notion
  is a third adapter against the same contract.*
- **One pipeline behind it,** identical for every source: convert → fidelity
  report → attachments → link rewriting → author mapping → placement → status
  stamp → idempotency → per-page report.
  - **Attachments.** Images upload to the `doc-images` bucket under the
    imported doc's path and are rewritten to the authenticated
    `/api/images/<path>` form, so canonical markdown never holds an expiring
    link (C1). Non-image attachments (PDF, xlsx) are stored and linked, or
    listed per page for manual placement — nothing disappears silently.
  - **Internal links** resolve against imported doc ids, so cross-references
    survive the move.
  - **Authors** map to workspace members where a mapping exists. Unmapped
    authors become plain text, never broken mentions — a mention is not a
    doc-body node in this codebase and must not become one (C1).
  - **Status.** Imported docs arrive **approved** — they were the team's live
    truth — but stamped so the staleness clock starts at import. That turns
    "review 400 pages" into a queue instead of a wall.
  - **Idempotency.** Re-running keys on the source page id: a second run fixes,
    it never duplicates. *Enforced by a unique index on `docs.source_ref`, not
    only by the importer's own lookup — an import of 1,361 pages that dies at
    900 is exactly when someone re-runs it, and exactly when a bug in that
    lookup would produce 900 duplicates nobody wants to delete by hand.*
- **A fidelity gate anyone can run before committing,** exiting non-zero past a
  2% page failure rate, and naming unhandled macros, unhandled elements and the
  worst pages by retention. Tables are the known weak point — colspan, rowspan
  and alignment are unrepresentable in GFM — so the report must quantify how
  many pages that actually degrades. Those pages go on a manual list; they do
  not block the run.
- **Two ingest surfaces.** A CLI covers self-hosters. An admin upload UI is
  required, not optional: a hosted customer has no shell, and "email us your
  zip" is not a migration path. Same pipeline behind both.
  *Shipped: `pnpm import` (dry run by default) and Settings → Import, which
  takes a zip up to 20 MB and says to use the CLI above that. One pipeline, two
  ways in.*
- **Reports land in the workspace,** as a doc: every `ConversionNote` — dropped
  content, unsupported macro, orphaned attachment — on a per-page checklist the
  team can work through and tick off in Aqli itself. *Shipped. The report
  distinguishes a macro the converter knows it cannot represent from one it has
  never seen, which is what tells a reviewer whether to expect a handler to
  exist.*

### Run

🔐 Map source spaces to Aqli spaces (a small config, reviewed before the run —
data-driven, not guessed). Run the fidelity gate against the real export and
read it. Import. Spot-check pages, weighted toward image-heavy and table-heavy
ones. Work the cleanup checklist with a pilot team, ideally with an assistant
connected over MCP doing the sweep.

### Acceptance

- [x] Import report lists every dropped or unhandled item; zero silent losses — including attachments the image bucket cannot take and links to pages outside the export.
- [x] Re-running the importer produces 0 duplicates: asserted end to end against a fake workspace, and enforced by a unique index (`supabase/tests/import_source_ref.sql`).
- [x] The same zip imports through both the CLI and the admin UI, with identical results — both call `runImport`; there is one importer.
- [x] Tree, images and cross-links survive a realistic archive (`lib/import/__tests__/end-to-end.test.ts`).
- [ ] Fidelity report produced against a real export; failure rate ≤2% or waived per page by the operator — needs the export.
- [ ] Ten spot-check pages (≥2 image-heavy, ≥2 table-heavy) correct in a real workspace — needs a deployed instance.
- [ ] Markdown exported by F-6 re-imports through the markdown adapter unchanged — waiting on F-6.

---

## F-2 — Connect any assistant (MCP)

**Status: the server is done. The way a customer connects to it is not.**

**Why every customer needs it:** this is the reason to choose Aqli rather than a
cheaper Confluence. It has to work for whatever assistant the customer already
uses — Claude Code, a desktop client, an internal agent platform — without
bespoke glue per customer, and without their non-technical staff learning what a
bearer token is.

### Build

- **`POST /api/mcp` — stateless JSON-RPC.** No SSE session affinity (hostile to
  Workers). Auth is `Authorization: Bearer aqli_…`: the same key the REST agent
  API takes, so there is one key concept, not two. No OAuth in v1 — clients
  store the key per connection.
- **A deliberately small toolset.** Thin wrappers over existing modules, no new
  data paths. A fat toolset taxes every chat turn the customer pays for.

  | Tool | Wraps | Scope |
  |---|---|---|
  | `search_docs` | `queryContext` (RAG over approved docs) | read |
  | `list_docs` | `listAgentDocs` | read |
  | `read_doc` | `getAgentDoc` | read |
  | `propose_doc` | `proposeAgentDoc` (create) | propose |
  | `propose_update` | `proposeAgentDoc` (revise, optimistic concurrency) | propose |
  | `request_review` | `setAgentDocStatus` | propose |

- **Tool descriptions state the contract plainly:** writes land as proposals and
  a human approves before anything becomes trusted context. Results carry the
  doc's web `url` so an assistant can link what it cites.
- **Scope enforcement at the MCP layer.** The database decides merge-vs-queue
  but never rejects, so a `read`-only key could still queue a proposal —
  contradicting what `DEFAULT_AGENT_SCOPES` documents. The MCP layer refuses the
  propose tools for a key without `propose` (or `write`), naming the missing
  scope.
- **Attribution end to end (C5).** The key's `owner_user_id` is a real member,
  agent writes appear in the AI-activity log under that owner, and the propose
  tools accept `on_behalf_of` so the review queue shows the human who asked. No
  shared machine key owned by nobody.
- **No `@modelcontextprotocol/sdk` in the worker graph.** The surface needed —
  initialize, tools/list, tools/call, ping — is small enough to hand-roll, and
  C4 leaves no room for an SDK.
- **The endpoint has to be discoverable from Settings.** Everything above is
  reachable today only by reading the README, which means every customer's
  rollout needs an engineer — the same as saying only engineering adopts. The
  remaining work is small, because Settings → API keys already creates keys,
  already toggles `read`/`propose`, and already shows a snippet when a key is
  revealed: that snippet names `/api/agent` only. It should name `/api/mcp`
  too, with the `claude mcp add --transport http …` line and the JSON config
  form beside it. A few lines in `KeysClient`, not a new page.
- **One retrieval story, documented.** Aqli's `search_docs` is authoritative for
  Aqli docs. A customer who already runs an index over their file storage or
  intranet keeps it for those sources; we do not ask anyone to double-index the
  same content, and the docs say so plainly.

### Run

🔐 Create a key with `read, propose`, one per assistant or pipeline so the
activity log can tell them apart. Add the connection in each assistant. Ask it a
question your handbook answers, and ask it to draft something.

### Acceptance

- [x] Six tools defined, scope-gated, with tests covering dispatch, scope refusal and error mapping.
- [x] Scope refusal lives above the database: a `read`-only key is refused the propose tools by name, since the merge engine queues but never rejects.
- [ ] `claude mcp add --transport http aqli https://<domain>/api/mcp` works with a bearer key; all six tools callable against a deployed instance.
- [ ] "What's our policy on X?" retrieves an approved doc and links it.
- [ ] "Draft a doc about Y in Marketing" appears in the review queue, attributed, and is **not retrievable before approval**.
- [ ] An admin connects an assistant from Settings without leaving the app or reading the repo.
- [x] Bundle measured with the endpoint: **2,400.75 KiB** gzipped against a **2,389.01 KiB** baseline — **+11.7 KiB**, 671 KiB of headroom under C4.

---

## F-3 — Sub-pages

**Status: shipped.**

**Why every customer needs it:** every wiki people are leaving is a tree
(Benefits → Leave → Parental leave). Flattening it on the way in makes the
migrated content unfindable for exactly the non-technical staff the move is
supposed to serve, and "make more spaces" only postpones the problem. This
reorders our own roadmap, where sub-pages sit behind import; import without a
tree lands content nobody can navigate.

### Build

- `parent_doc_id uuid null` + `position` on `docs` (same table, tenancy
  unchanged), with a **DB-level** cycle guard — no doc may become its own
  ancestor — and a depth cap (real corpora rarely exceed ~5; enforce ~8).
  *Shipped in `20260811000000_doc_tree.sql`. The guards are triggers rather
  than application code because the REST API, the agent API, MCP and an
  importer all reach the same table; a cycle created through any of them is
  the same cycle. A subtree is confined to one space, which is what keeps F-4's
  privacy boundary from having a hole in it before it is built.*
- Space sidebar renders the tree with expand/collapse; drag to reorder and
  re-parent within a space. Moving a parent moves its subtree. Deleting a parent
  re-parents children to the grandparent — never orphans, never cascade-deletes.
- Breadcrumbs on the doc view; tree position (space › parent path) in search
  results.
- Agent surface: `list_docs` gains `parent_id`; `read_doc` returns `parent_id`
  and child count; `propose_doc` accepts `parent_id`. MCP tool docs updated with
  them. *Shipped, on the REST agent API too. `read_doc` returns a child **count**
  rather than the children: inlining a subtree would put an unbounded amount of
  text in front of a model that asked for one document. Placement rides on the
  `doc_parent_id` frontmatter control key, the same channel `doc_type` and
  `doc_status` already use, so every creation path — proposal, importer — places
  a page the same way and the database validates it once.*
- Editor and read view untouched: the tree is metadata, not markdown (C1).

### Acceptance

- [x] A cycle attempt is rejected at the DB layer (`supabase/tests/doc_tree.sql`), not only in the UI — along with self-parenting, a cross-space parent, and nesting past the cap.
- [x] A move writes activity, not a content revision — and does not restamp `updated_at`, so reorganising a space does not float every page it touched to the top of every list.
- [x] Deleting a parent re-parents its children to the grandparent; it never orphans and never cascades (test).
- [x] A 3-level chain navigates correctly: breadcrumbs on the doc view, parent shown in search results.
- [ ] The importer places docs under their source parents — F-1, which this unblocks.
- [ ] A non-technical user drags a page to a new parent and it survives reload — needs a person and a deployed instance.

---

## F-4 — Space permissions

**Status: not started.** ~2–3 days. Before company-wide rollout; after pilot.

**Why every customer needs it:** switch test #2. Every company has content People,
Finance or Legal will not put in a room the whole company can read, and those
teams are usually the ones with the most documentation debt. Without this,
adoption stalls at "the engineering and marketing wiki" — which is the same
place the evaluation started.

### Build

- `space_members(space_id, user_id, role)` + RLS. A **private** space's docs,
  comments, activity, search results and RAG context are visible only to its
  members; **open** spaces stay workspace-visible (the default). Admins manage
  membership; the toggle lives in the existing Settings → Spaces.
- **The boundary holds in every read path**, enumerated and tested: docs list,
  doc view, `searchDocs`, `queryContext`, notifications, review queue,
  backlinks, activity feed, the REST agent API, and every MCP tool. **The agent
  path inherits the key owner's space visibility** — that single rule is what
  keeps assistant answers leak-free, and it is the one most easily forgotten,
  because the agent path is the one nobody clicks through by hand.
- **Named reviewers:** a per-space list of members whose approval merges
  proposals there, completing the `review_all` machinery that today does not say
  who approves. Minimal version: a space member with role `reviewer`.
- A tenant/visibility test in `supabase/tests/` per read path (C3).

### Acceptance

- [ ] A non-member cannot read a private space's docs via UI, REST, search, RAG or MCP — a test per path.
- [ ] A question answerable only from a private space returns nothing for a non-member's key: no title, no existence leak.
- [ ] A proposal in a guarded space merges only on a named reviewer's approval, and the trail records who.

---

## F-5 — Day one for people who did not choose the tool

**Status: partly shipped.** ~1 day of product work; a two-week pilot to prove it.

**Why every customer needs it:** the buyer is technical and the users are not.
Everything below exists because a non-technical teammate who cannot find, edit
or illustrate a page will quietly go back to what they used before, and nobody
will hear about it until the renewal.

### Build

- **Invitations and account recovery that work in production**, with email
  confirmation **on** — the README's "disable confirm email" note is
  development-only and needs to say so where a self-hoster will read it.
- **Starter docs, seeded on workspace creation:** a "How we run Aqli" page (what
  each review policy means, who approves what, what the staleness queue is for)
  and an ops runbook template (where prod lives, how to deploy, how to export,
  backup posture). Every adopting company writes these two documents; shipping
  the template is cheaper for us than the support thread is for them, and it
  puts the first real doc in the workspace on day one.
- **Review policy in plain language** at the point of choice in Settings →
  Spaces: `open` (everyone merges), `review_agents` (default — humans edit
  freely, agent writes queue), `review_all` (everything queues).
- **Notification reach.** There is no mail transport in the repo, so mentions
  and review requests reach people through the in-app bell only. At small
  headcount that is survivable; for a team that lives in chat it is the most
  likely reason a pilot stalls. The generic remedy is an **outbound webhook per
  workspace** on mentions and review-queue events — chat-agnostic, small, and it
  serves Slack, Teams and Discord customers equally. A bespoke bot for one chat
  tool is a worse trade at this stage, and email transport is its own project.

### Run

Invite everyone. Set each space's review policy — default `review_agents`
everywhere, `review_all` only where a team asks. 🔐 Create the assistant keys.
Then pilot: two teams use Aqli as their only docs tool for two weeks after
import. Success is that they stop opening the old wiki. Every friction item
becomes an issue triaged into fix-before-rollout / fix-later / roadmap.
🔐 Check the Supabase project's region against your data-residency stance before
there is data worth moving.

### Acceptance

- [ ] Every member has signed in once; no password-flow failures.
- [ ] A designated non-technical pilot member completes unassisted: find a doc, edit it, paste a screenshot, comment with an @mention, see the notification.
- [ ] "How we run Aqli" and the ops runbook exist as approved docs, seeded not written from scratch.
- [ ] Backup restore tested once (a scratch project counts).

---

## F-6 — The exit door

**Status: not started.** ~1–2 days.

**Why every customer needs it:** switch test #6, and the cheapest trust we will
ever buy. Everyone leaving a proprietary wiki has just learned what lock-in
costs, and they will ask. Answering "markdown is canonical, so an export is
lossless by construction" is only half an answer until there is a button.

### Build

- **Workspace export** from Settings and from the CLI: a zip of markdown plus
  images, laid out `space/parent-path/doc.md`, each file carrying front matter
  (title, space, status, parent path, latest revision id, timestamps). Image
  links rewritten to relative paths inside the zip so the export reads correctly
  offline.
- **Deterministic output**, so two exports of unchanged content are byte-identical
  and a customer can diff them.
- **Re-importable through F-1's markdown adapter.** The export/import round trip
  is the test that keeps both honest, and it is what makes the claim checkable
  rather than rhetorical.
- Large workspaces stream rather than buffering — the export must not be the
  thing that discovers the worker memory ceiling.

### Acceptance

- [ ] An admin produces a full export from the UI without a shell.
- [ ] The export re-imports into an empty workspace with content, images and tree intact.
- [ ] Two exports of unchanged content are byte-identical.
- [ ] Exporting the largest workspace we can synthesize does not exhaust worker memory.

---

## Decisions every adopter has to make

Not open questions for us — questions the adopting company answers, which the
product should ask them at the right moment rather than leave to discovery.

1. **Does anything confidential move on day one?** Yes pulls F-4 in front of the
   pilot. This is the most common reason an adoption plan is re-cut mid-flight.
2. **Is the in-app bell enough?** Answered by the pilot, not before it. If it is
   not, the webhook in F-5 is the minimum remedy.
3. **Which source spaces are live enough to import?** Every wiki being left has
   dead space in it, and importing it is how a fresh start inherits old rot.
4. **Where does the data live?** Cheapest to settle while the workspace is
   nearly empty.

## Sequence

```
F-0 (1d, operator-gated) ──► F-3 (2–3d) ──► F-1 (3–5d) ──► F-5 pilot (2wks) ──► F-4 (2–3d) ──► rollout
                         └──► F-2 (server done; Settings snippet, an afternoon)
                         └──► F-6 (1–2d, any time before cutover)
```

Roughly two engineer-weeks of build around a two-week pilot — and the pilot is
the part that cannot be compressed, because it is the only step that measures
something we did not choose ourselves.

## Not part of adoption

Real product work, but no company is blocked from switching without it: public
share links, a chat Q&A bot, real-time co-editing (Yjs), per-page permissions,
email transport, SSO bridging to a customer's identity provider, and unifying
Aqli's RAG into someone else's index. They live in `ROADMAP.md`. Promote one
only when a pilot produces a hard requirement — notifications (F-5) is the
likeliest.
