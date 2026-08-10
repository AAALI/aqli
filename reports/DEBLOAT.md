# Debloat review — what is actually dead, and what only looks it

Reviewed against `b52f015`. No code deleted. This is the report the brief asks
for before anything is removed.

**Headline:** the codebase is smaller than the brief assumes and the worker is
comfortable. The two biggest named targets — `lib/confluence/` and
`components/landing/` — are both live, and deleting either would cost something
real. What *is* dead is smaller and duller: about 950 lines across five
orphaned files and three unreachable routes.

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

## Recommendation

1. **PR 1 — dead code.** The six-row table above, ~302 lines. No schema change,
   no rollback file needed. Low risk.
2. **Decision needed — the 663 commented Composio lines.** Delete or keep? My
   vote is delete; the handover's reasoning is why it is your call.
3. **PR 2 (optional) — lazy-load `posthog-js`.** ~60 KiB off the worker.
4. **The real prize is not a deletion.** Retiring `AQLI_MERGE_ENGINE` is what
   unblocks `doc_versions`, `snapshotVersion`, and the
   `documents_no_direct_write` policy in one go. That needs the `body_md`
   backfill run first (handover item #1, blocked on `SUPABASE_SERVICE_KEY`).
   Every large duplicate in the brief's table is downstream of that one
   environment variable.

The pattern the brief names is real — second halves of migrations never
happened — but the reason is not neglect. Three of the five outstanding ones
are queued behind a backfill that cannot run from a sandbox. That is a
credentials problem, not a code problem.
