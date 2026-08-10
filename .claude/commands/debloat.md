---
description: End-to-end review of what Aqli actually needs, and a deletion plan for what it doesn't.
---

# Find and remove the bloat

Aqli is one product: **people and agents write documents, AI keeps them
current, humans verify, and assistants read the approved result.** It is around
30,000 lines of TypeScript across 39 API routes and 24 pages. That is more than
the product needs, and the reason is specific and fixable.

## The failure mode to look for

**Nothing in this codebase has ever been deleted.** Every migration kept both
sides. Go and confirm each of these before acting — they are the pattern, and
there will be more:

| Old | New | State |
|---|---|---|
| `doc_versions` | `revisions` | both present, one read by nothing |
| `docs.status = 'review'` | `proposals` queue | two review systems, both live |
| `body_json` | `body_md` | both written, one is a cache |
| `trigger_ids` | `github_hook_ids` | both on the row |
| `composio_user_id` | GitHub tokens | retained deliberately |
| direct writes | `AQLI_MERGE_ENGINE` | flag with both paths live |

Each was individually reasonable — a safe migration keeps the old path until
the new one is proven. The bloat is that the second half of every migration
never happened. **Your job is the second halves.**

## Do this

1. **Map what runs.** For each of the 39 routes and 24 pages: what user-visible
   behaviour breaks if it disappears? Say it in one sentence. If you cannot,
   that is the finding.

2. **Find the dead.** Exports with no non-test caller; tables read by nothing;
   feature flags whose off-branch nobody will ever take again; API routes the
   UI never calls. Known starting points, verify each:
   - `lib/confluence/` (~580 lines + tests) — a Confluence importer with no
     ingest surface. Nothing outside its own tests imports it.
   - `components/landing/` (~3,100 lines, 10% of the codebase) — `FlowDemo.tsx`
     alone is 1,742 lines of animated marketing demo, built and shipped with the
     product.
   - `/api/agent/docs/[id]/review` — documented as vestigial.
   - `doc_versions` — "read by nothing", retained for an audit that has happened.
   - Six AI endpoints (`ask`, `consistency`, `cowrite`, `related`, `rewrite`,
     `summary`). Check which are reachable from the UI at all.

3. **Collapse the duplicates.** For each row of the table above, decide: is the
   old path still load-bearing? If the migration is complete, delete the old
   side, its columns, its types, and its tests, in one migration with a rollback.
   If it is not complete, say what is blocking it — that is a handover item, not
   a deletion.

4. **Measure the worker.** `npx opennextjs-cloudflare build && npx wrangler
   deploy --dry-run`. Currently ~2,210 KiB gzipped against a 3,072 limit.
   Attribute anything large before assuming it is needed. The rule that keeps
   being violated: **anything reachable from a page's server module graph is in
   the worker, whether or not it renders.** A one-line helper imported from a
   big module drags the whole module in — that one cost 684 KiB.

5. **Report before deleting.** A table: what, how many lines, what breaks if it
   goes, and your confidence. Then stop and let a human choose. Deletion is
   cheap to do and expensive to undo.

## Do not delete these

They look redundant and are not. Check the reasoning before touching any of
them; if you still think one should go, argue it explicitly rather than
quietly removing it.

- **`lib/markdown/schema.ts` deriving the editor schema and the serializer from
  one extension list.** This looks like indirection. It is the thing that
  stopped tables and images being silently dropped on save, and there is an
  eslint rule enforcing it. `body_md` is canonical — anything the editor can
  produce that the serializer cannot write is permanent data loss.
- **`integration_secrets` having RLS on with no policies.** That is not a
  missing policy. It is what makes repo-scoped tokens unreachable from a user
  session, and there is a test asserting the absence.
- **The `ScopedClient` wrapper in `lib/db`.** It exists because cross-workspace
  reads happened before it.
- **The disposition truth table in `lib/merge/disposition.ts` and
  `app.decide_disposition`.** Duplicated on purpose, asserted in both.
- **The `ssr: false` loader components.** Each is a near-empty file that looks
  like ceremony; each keeps ~450 KiB of editor out of the worker.

## Ground rules

- Verify every claim against the code before acting on it, including the ones
  in this file. They were true when written.
- One concern per PR. A deletion PR that also refactors is unreviewable.
- `pnpm test`, `pnpm test:sql`, `pnpm typecheck`, `pnpm lint`, and the OpenNext
  build all pass before and after. Report the bundle delta.
- Every schema change gets a rollback file, replayed against a scratch database.
- If deleting something would lose data, that is a handover item for a human,
  not a deletion.
