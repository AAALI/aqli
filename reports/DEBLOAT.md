# Debloat review — what is actually dead, and what only looks it

Reviewed against `b52f015`. No code deleted. This is the report the brief asks
for before anything is removed.

**Headline:** the codebase is smaller than the brief assumes and the worker is
comfortable. The two biggest named targets — `lib/confluence/` and
`components/landing/` — are both live, and deleting either would cost something
real. What *is* dead is smaller and duller: about 340 lines across seven
orphaned files and three unreachable routes.

**The two findings worth reading first are not deletions.** Reviewer feedback
on rejected docs is written to a table nothing reads and displayed nowhere
(finding A), and a purpose-built `document_links` table sits empty while the
feature it was built for runs an unindexable `ilike` scan on every doc page
view (finding B). Both were found by auditing tables rather than code, which is
the axis the brief's method does not cover.

---

## Baseline (green before any change)

| Check | Result |
|---|---|
| `pnpm test` | 212 tests, 11 files — pass |
| `pnpm test:sql` | `canonical_flip`, `integration_secrets`, `merge_engine` — pass |
| `pnpm typecheck` | clean |
| `pnpm lint` | clean |
| `opennextjs-cloudflare build` + `wrangler deploy --dry-run` | **2209.90 KiB gzip** / 3072 limit — **862 KiB headroom** |

Source is **31,524 lines** of TS/TSX (app 9,859 · components 11,722 · lib 9,569 ·
types 374), 39 API routes, 24 pages. The 2,210 KiB matches the handover's 2,215,
so the worker has not drifted since #47.

---

## Four claims in the brief that are false

**1. `lib/confluence/` is not orphaned.** `scripts/confluence-fidelity.ts:21`
imports `confluenceStorageToMarkdown`, and it is wired up as `pnpm
confluence:fidelity` in `package.json`. That command is *handover item #2* —
the fidelity gate that still has to run against the real Confluence export,
blocked only because the export zip is not in this sandbox. It is also not in
the worker: nothing imports it from a route, so the bundler never sees it
(`HANDOVER.md:138` says this was already checked). Deleting 578 lines saves
**0 KiB** of worker and throws away the tool for a task that has not happened
yet.

**2. `components/landing/` is the public front door, and it is cheap.** It
renders `app/page.tsx` (`/`), `/terms` and `/privacy`. In the worker it is
`components_landing_LandingPage_tsx_*.js` — **12 KiB gzipped of 2,210**, or
0.5%. The "10% of the codebase" figure is true by line count and misleading as
a cost: 3,140 lines of mostly-static JSX compress to almost nothing. Deleting
it deletes the marketing site. That is a product decision, not debloating.

**3. All six AI endpoints are reachable.** `ask` (3 callers), `related` (3),
`consistency`, `cowrite`, `rewrite` (1 each via `components/editor/v2/*`, all
mounted from `DocEditorClient`). Only `summary` is dead — see below — and it is
dead because its one caller is an unmounted component, not because the endpoint
was never wired.

**4. `doc_versions` is not merely retained — it is still being written.**
`snapshotVersion` (`lib/supabase/docs.ts:339`) inserts into it from `createDoc`
and `updateDoc`. With `AQLI_MERGE_ENGINE=1`, `saveDoc` still routes
metadata-only updates down the direct path (`!hasContentChange(updates)` →
`updateDoc`), so status changes and metadata edits keep appending rows today.
"Read by nothing" is right; "dormant" is not. Note also that `getDocVersions`,
despite the name, reads `revisions` — the only true `doc_versions` reader is
`getLegacyDocVersions`, which has no callers at all.

---

## Genuinely dead — recommended deletions

| What | Lines | What breaks | Confidence |
|---|---|---|---|
| `components/ai/AskQuestion.tsx` | 121 | Nothing. Zero importers anywhere. | High |
| `components/ai/DocSummary.tsx` | 62 | Nothing. Zero importers anywhere. | High |
| `app/api/ai/summary/route.ts` | 64 | Nothing, *once `DocSummary` goes* — it is the only caller in the repo. | High |
| `app/api/docs/[id]/versions/route.ts` | 19 | Nothing. The three doc pages call `getDocVersions()` server-side; no client fetches this URL. | High |
| `app/api/agent-log/route.ts` | 22 | Nothing. `agent-log/page.tsx` calls `getWorkspaceAgentActivity()` directly. | High |
| `lib/supabase/docs.ts` → `getLegacyDocVersions` | ~14 | Nothing. The step-3 backfill audit it existed for has happened. | High |
| **Subtotal** | **~302** | | |

All six are one concern — "unreachable code" — and belong in one PR. None of
them touch the schema, so no migration and no rollback file.

A second, larger candidate with a caveat:

| What | Lines | What breaks | Confidence |
|---|---|---|---|
| `lib/integrations/source/composio-routes.reference.ts` | 497 | Nothing executable — the file is 100% commented out. | High (that it is inert) |
| `lib/integrations/source/composio.ts` | 166 | Nothing executable — also commented. | High (that it is inert) |

**But `HANDOVER.md:334` says these were commented rather than deleted on
purpose**, so restoring Composio needs only `pnpm add @composio/core` and
uncommenting. That is a deliberate retention with a stated reason. I would
delete them — git history is the better archive for a path nobody has committed
to taking, and 663 lines of commented code is a standing invitation to
confusion — but that is an argument to have, not a cleanup to perform quietly.

---

## Looks redundant, is load-bearing — do not delete

- **`docs.status = 'review'` is not a dead duplicate of `proposals`.**
  `RequestReviewButton` is mounted on the doc page (`docs/[id]/page.tsx:104`)
  and in `ProcessStrip`, and the review queue deliberately renders both systems
  side by side (`review/page.tsx` fetches `getOpenProposals` *and*
  `getPendingReviewDocs`). Two live review systems is a real product wart, but
  both are user-reachable. Collapsing them is a feature change with UI work,
  not a deletion.
- **`/api/integrations/composio/simulate`** has no callers because it is a
  dev-only test harness for the PR→doc pipeline, 404'd in production unless
  `ALLOW_INTEGRATION_SIMULATE=true`. It is how the pipeline gets exercised
  without a signed webhook.
- **The five `/api/agent/*` routes** have zero in-app callers by design — they
  are the public agent REST API, which is the product.
- **`/api/integrations/github/webhook`** is called by GitHub, not by us.
- Everything in the brief's own do-not-delete list checked out as described.
  `lib/markdown/schema.ts`, `integration_secrets`' policy-less RLS (asserted in
  `supabase/tests/integration_secrets.sql`), `ScopedClient`, the duplicated
  disposition truth table, and the four `ssr: false` loaders are all doing what
  the comments say.

---

## Blocked — handover items, not deletions

| Old path | Why it cannot go yet |
|---|---|
| `doc_versions` + `snapshotVersion` | Still written on every status/metadata change. Dropping the table needs the direct-write path retired first, and drops history rows that exist nowhere else. |
| `AQLI_MERGE_ENGINE` off-branch | It is the documented rollback lever (`HANDOVER.md` deploy order step 6), and spec §2.3's `documents_no_direct_write` policy is explicitly waiting on it. Retiring the flag is the unlock for two other cleanups — the highest-value item on this list. |
| `trigger_ids`, `composio_user_id` | Kept deliberately so a Composio restore needs no backfill. Dropping is unrecoverable. |
| `/api/agent/docs/[id]/review` | Vestigial but kept so already-deployed agents do not break. Removing it is a breaking public-API change — product call, with a deprecation window. |
| `body_json` | Not collapsible: step 6 has not been exercised against real data because the backfill has not run. Still the editor's fast-open cache. |

---

## Worker: one finding worth acting on

At 862 KiB of headroom nothing here is urgent, but the largest avoidable thing
in the worker is not what you would guess.

| Chunk | gzip | Verdict |
|---|---|---|
| `lib_supabase_agent-docs_ts_*` | 183 KiB | Real — the markdown pipeline. Handover says don't chase it; agreed. |
| **`posthog-js`** | **60 KiB** | **Avoidable.** See below. |
| `@supabase/supabase-js` | 48 KiB | Real. |
| `openai` | 30 KiB | Real. |
| `components/landing/*` | 12 KiB | Real, and cheap. |

**`posthog-js` is a browser library sitting in the server bundle.** It is
imported at module top level by client components that are server-rendered —
`login/page.tsx`, `invite/InviteClient.tsx`, `ReviewQueueClient.tsx`,
`NewDocClient.tsx` — so it lands in the worker's module graph and does nothing
there. This is precisely the rule the handover records: *anything reachable
from a page's server module graph is in the worker, whether or not it renders.*
Moving the `posthog.capture` calls behind a lazy `await import("posthog-js")`
should recover most of the 60 KiB. Separate PR, separate concern from any
deletion.

---

## Second pass — what the first sweep missed

The first pass audited routes and exports. It did not audit dependencies,
tables, SQL functions, pages, static assets or CSS. Doing that turned up two
things that matter more than any of the deletions above, and one correction to
this report.

### A. `doc_comments` is write-only — reviewer feedback is silently discarded

This is a defect, not bloat, and it is the most important finding here.

`rejectDoc` and `requestChanges` (`lib/supabase/review.ts:174,200`) are both
live — `/api/review/[id]/route.ts` calls them from the review queue. Each takes
the reviewer's typed text (a rejection `reason`, a change-request `note`) and
writes it to `doc_comments`.

The only function that reads that table is `getDocComments`
(`lib/supabase/review.ts:219`), and it **has zero callers**. The same text is
also copied into `doc_activity.metadata.reason` / `.note`, and
`DocActivityFeed.tsx:83` renders only `metadata.to_status` — never the reason.

So the text is stored in two places and displayed in neither. A doc author
whose work is rejected sees "*Reviewer* rejected this doc" and cannot find out
why. `types/comment.ts` (16 lines, zero importers) is unused for the same
reason.

**This is a missing read, not dead code. Do not delete `getDocComments` — wire
it up.** That is the opposite of the disposition my first pass implied.

### B. `document_links` — a purpose-built table that nothing writes, next to an unindexed scan

`document_links` is created with two indexes, RLS enabled and a read policy
(`20260805000000_markdown_canonical_schema.sql:299-448`, spec §2.2). No
TypeScript reads or writes it — the only mention outside migrations is its
entry in `lib/db/scoped.ts:33`.

Meanwhile the feature it was built for is implemented anyway:

```ts
// lib/supabase/docs.ts:390
.ilike("body_md", `%/docs/${docId}%`)
```

A leading-wildcard `ilike` over every document body in the workspace cannot use
an index, and it runs on every doc page view. The table that would fix it is
sitting empty. So this is dead schema **and** a live performance problem whose
solution was already built and never connected.

Either wire `document_links` up (populate it in the merge path, read it in
`getBacklinks`) or drop it. Both are real work; neither is a quiet deletion.

### C. Correction — `mermaid` is not unused, and there is a fifth protected loader

My dependency scan first reported `mermaid` as having zero importers. That was
a bad regex: it is loaded via `await import("mermaid")` inside
`components/editor/MermaidView.tsx`, which exists precisely so the extension
can be pulled in with `ssr: false`. Its header records that mermaid's tree —
cytoscape, katex, dagre, d3 — came to **3.2 MiB** of a 3 MiB worker.

**The brief's do-not-delete list names four `ssr: false` loaders. There are
five.** `MermaidView.tsx` is the same pattern and the single largest saving of
any of them. It should be on that list.

### D. Additional dead items

| What | Size | What breaks | Confidence |
|---|---|---|---|
| `hast-util-to-string` dependency | — | Nothing. Zero references in the entire repo. | High |
| `types/comment.ts` | 16 lines | Nothing (see finding A). | High |
| `isFixedPoint` (`lib/markdown/index.ts:90`) | ~8 lines | Nothing. Zero references anywhere, including tests. | High |
| `nextStep` / `prevStep` (`lib/onboarding/plan.ts`) | ~12 lines | Nothing in production — tested, never called by the app. | High |
| `app/…/settings/agents/page.tsx` | 9 lines | A legacy-URL redirect to `agent-log` with no inbound link. Harmless; delete only if you don't care about old bookmarks. | Medium |
| `.avatar-ali`, `.avatar-khalid`, `.avatar-sara`, `.avatar-lg` | 4 rules | Nothing. Design-handoff leftovers; the app uses `avatar-sm` + `avatarColor()`. | High |

### E. Checked and clean — negative results worth recording

- **All 24 pages are reachable.** `search` has no nav link but is reached from
  the command palette (`CommandPalette.tsx:160`).
- **`public/` is 72 KB.** The handover's "7.4 MB of static assets" is
  `_next/static` build output, not committed files. `_headers` and `llms.txt`
  are unreferenced by code *by design* — Cloudflare and crawlers consume them.
- **`app/globals.css`: 131 of 136 classes used.** Not a bloat site.
- **All 15 `app`/`public` SQL functions are live.** The four with no TypeScript
  references (`is_member`, `md_headings`, `md_to_text`, `record_migration_gate`)
  are called from RLS policies, the `docs_maintain_derived` trigger, and the
  backfill script.
- **No stranded v1 editor.** `AqliEditor` is live via `DocBody` and
  `lib/markdown/schema.ts`.
- **Every other npm dependency is imported.** (`react-dom` has no direct import
  but is a Next peer.)
- **My export sweep was ~85% false positives** — symbols used within their own
  defining file. Worth stating so nobody re-runs it and trusts the raw output:
  of ~78 hits, the genuinely dead ones are the six in section D plus the two
  already listed above.

---

## Recommendation

Ordered by what actually matters, which is not the deletions.

1. **Fix the discarded reviewer feedback (finding A).** Users are losing
   written input today. Wire `getDocComments` into the doc page, or render
   `metadata.reason` in `DocActivityFeed`. Smallest change, highest value,
   nothing to do with bloat.
2. **Decide `document_links` (finding B).** Wire it up and drop the `ilike`
   scan, or drop the table. Leaving it is the worst of the three.
3. **PR 1 — dead code.** The six-row table above plus section D, ~340 lines.
   No schema change, no rollback file needed. Low risk.
4. **Decision needed — the 663 commented Composio lines.** Delete or keep? My
   vote is delete; the handover's reasoning is why it is your call.
5. **PR 2 (optional) — lazy-load `posthog-js`.** ~60 KiB off the worker.
6. **The real prize is not a deletion.** Retiring `AQLI_MERGE_ENGINE` is what
   unblocks `doc_versions`, `snapshotVersion`, and the
   `documents_no_direct_write` policy in one go. That needs the `body_md`
   backfill run first (handover item #1, blocked on `SUPABASE_SERVICE_KEY`).
   Every large duplicate in the brief's table is downstream of that one
   environment variable.

The pattern the brief names is real — second halves of migrations never
happened — but the reason is not neglect. Three of the five outstanding ones
are queued behind a backfill that cannot run from a sandbox. That is a
credentials problem, not a code problem.
