# Handover — what needs a human

Steps 1–6 of the markdown-canonical migration are written, tested and on the
branch. One thing still cannot be done from an agent sandbox, and **step 6
cannot be deployed until it is** — not as a matter of discipline, but because
the migration refuses to apply without it.

---

## 1. Run the `body_md` backfill — blocks step 6

**Blocked on:** `SUPABASE_SERVICE_KEY`. It is held in Cloudflare and is not
reachable from the sandbox; the Supabase connector available here exposes only
publishable keys.

Every `body_md` in production was written by the old hand-rolled converter,
which drops text. Measured against the production copy: **87 words across 27
documents**, mostly identifiers out of code spans, table cells and nested list
items (`20260610010000`, `snake_case`, `supabase_realtime`). Those words exist
only in `body_json`. Step 6 makes `body_md` canonical, so flipping first makes
the loss permanent.

```bash
export SUPABASE_URL=https://bxhagsiaenvcksckhize.supabase.co
export SUPABASE_SERVICE_KEY=...        # from Cloudflare

pnpm backfill:markdown                 # dry run — writes nothing
pnpm backfill:markdown -- --apply      # writes, after you have read the dry run
```

**What it does.** Regenerates `body_md` from `body_json` with the new
serializer, gated on the round-trip test passing for that document. A document
that fails the gate is logged and skipped, never written. The report lands in
`reports/markdown-backfill.md`.

**Expect 0 gate failures.** If any document fails, that is a finding worth
reporting before step 6, not something to force through.

**On a clean apply it records `body_md_backfill` in `app.migration_gates`.**
That row is what unlocks step 6. A run with any skipped or errored document
does *not* record it — a partial backfill leaves exactly the markdown that must
not become the only copy.

**Why `updated_at` is written back explicitly.** The `docs_maintain_derived`
trigger sets it to `now()` on every write and the document list is ordered by
it, so a backfill that let the trigger fire would reshuffle every list in the
app.

### One document needs attention first

There is a document with content in `body_json` and an empty `body_md`. Step 6
has a second guard, independent of the gate, that counts these and refuses:

```sql
select id, title from docs
where body_json is not null
  and body_json::text not in ('{"type":"doc"}', '{"type": "doc"}')
  and coalesce(body_md, '') = '';
```

The backfill should fix it. If it does not, look at the row by hand — the flip
would blank it.

---

## 2. Run the fidelity gate against the real Confluence export

**Blocked on:** `Tabadulat Platform Confluence Export.zip` is not present in
this environment. Unchanged from the previous handover, and independent of
steps 4–6.

```bash
unzip "Tabadulat Platform Confluence Export.zip" -d /tmp/confluence
pnpm confluence:fidelity --csv /tmp/confluence/entities/bodycontent.csv \
                         --out reports/confluence-fidelity.md
```

The command exits non-zero if more than 2% of pages fail the round-trip gate —
the brief's stop-and-report threshold. Also read *Macros with no handler*,
*Elements with no handler*, and the worst 20 pages by retention. **Tables
specifically**: alignment, colspan and rowspan are unrepresentable in GFM and
the export has 7,613 of them. That is the weakest point in the allowlist.

---

## Deploy order

The steps are independent up to 6, which is the one-way door.

1. **Apply migrations up to `20260805035000_migration_gates.sql`.** Safe on
   `main`: additive, and nothing reads the new functions until the flag is on.
2. **Deploy the application with `AQLI_MERGE_ENGINE=0`.** Behaviour is
   identical to before — every save is a direct write.
3. **Turn `AQLI_MERGE_ENGINE=1` on.** Saves become `propose → merge`. Every
   space defaults to `review_agents`, under which humans merge, so nothing
   changes from a user's seat; what it buys is a revision per change. Agent
   writes start landing in the review queue instead of editing documents
   directly. Watch `proposals` and the queue for a day.
4. **Run the backfill** (section 1). This is the step that unlocks the rest.
5. **Apply `20260805040000_body_md_canonical.sql`.** It will refuse if step 4
   did not happen. After this the editor reads markdown and `body_json` is a
   cache.
6. **Drop `AQLI_MERGE_ENGINE` from the environment.** It defaults on from step
   6 onward; setting it to `0` after the flip is a rollback lever that also
   stops writing revisions, so it is for getting out of trouble, not for
   staying there.

**`20260808000000_doc_comments.sql` is not part of this order either, and has
not been applied.** It touches only `doc_comments` — RLS policies, a
`comment_type` default and check, a `mentions uuid[]`, three indexes, and one
`app.doc_in_workspace` helper. It neither reads nor writes `docs.body_md`, so
it is independent of the backfill in both directions and can be applied to
production whenever the comments feature is deployed.

Two things to know before applying it:

- **It closes a live hole.** Until it runs, `doc_comments` has no RLS, and a
  table with RLS disabled applies no restriction — any authenticated user can
  read every comment in every workspace through PostgREST. The rows in there
  today are reviewers' rejection reasons. Worth applying ahead of the feature
  rather than with it.
- **`comment_type` becomes NOT NULL**, backfilled to `'comment'` for existing
  null rows. Check what is actually in the column first if that matters:
  `select comment_type, count(*) from doc_comments group by 1;`

Rollback is `rollback/20260808000000_doc_comments.down.sql`. It drops the
`mentions` column, and re-disables RLS — do not run it while the comments UI is
deployed.

**The two `doc-images` migrations are not part of this order, and are already
applied.** `20260806010000_doc_images_storage.sql` creates the bucket and its
RLS policies; `20260806020000_doc_images_require_doc_segment.sql` tightens the
write guard to require a doc folder in the path. Both touch only `storage` and
read `public.members`, so they neither depend on the backfill nor block it.

Applied to production on 2026-08-07 and verified there: bucket private, 10 MB
limit, PNG/JPEG/GIF/WebP only; RLS on with four `authenticated` policies; a
path in another workspace and a malformed non-UUID first segment both fail to
match, the latter without raising (which is why the policies compare
`workspace_id::text` rather than casting the segment).

Rollback files for each migration are in `supabase/migrations/rollback/`. The
step-6 one restores the schema but not the data: once the app has been writing
markdown-first, no migration can reconstruct what was only in the markdown.

---

## 3. The Cloudflare worker: what was actually in it

`Workers Builds` had been red since #45 because the worker exceeded the
free-plan limit. The number Cloudflare enforces is the one printed by:

```bash
npx opennextjs-cloudflare build
npx wrangler deploy --dry-run     # "Total Upload: ... / gzip: N KiB"
```

Static assets are **not** in that number — they upload separately (7.4 MB, 158
files). Neither are the repo's markdown specs, `reports/`, `scripts/`, or
`lib/confluence/`: nothing imports them from a route, so the bundler never sees
them. Checked, because it is the intuitive suspect and it is the wrong one.

| | gzipped | vs 3072 KiB limit |
|---|---|---|
| `main` | ~3410 | 338 over |
| drop `@composio/core` | 3116 | 44 over |
| stop server-rendering the editor | 2479 | 593 under |
| move one helper out of the PR pipeline | 2215 | 857 under |
| keep `posthog-js` out of the server graph | **2150** | **922 under** |

### A browser SDK was in the server bundle

Importing `posthog-js` from a Client Component puts it in the worker too,
because Client Components are server-rendered — 72 KiB of browser analytics
shipped to Cloudflare. Calls go through `lib/analytics.ts` now, which imports
it in the browser at call time; `instrumentation-client.ts` keeps its eager
`init`, since that entrypoint never enters the worker graph.

### The editor was in the worker to render nothing

Five chunks carried ProseMirror, three of them near-identical copies of the
same ~450 KiB — one per route tree that shows a document.

None of it produced output. `DocBody` and `DocEditorClient` both set
`immediatelyRender: false`, which is required for SSR correctness with Tiptap
and means the server pass emits an empty container. So the worker shipped a
rich-text editor, its extensions, and the entire markdown schema in order to
render `<div></div>`.

They now load through `next/dynamic` with `ssr: false`:

- `components/docs/DocBodyClient.tsx`
- `app/…/docs/[id]/edit/DocEditorClientLoader.tsx`
- `app/…/s/[space]/new/NewDocClientLoader.tsx`
- `app/…/docs/[id]/history/HistoryClientLoader.tsx`

Each is a thin Client Component that exists only because Next 16 rejects
`ssr: false` in a Server Component.

**The rule these encode:** anything reachable from a page's server module graph
is in the worker, whether or not it renders. Keep the loaders' own imports
trivial — `DocBody` takes `body_md` and parses it in the browser precisely
because doing the conversion in the wrapper would drag `aqliSchema` back in.

### One import can cost 684 KiB

The integrations settings page imported `isAutoApproveEnabled` — a one-line
predicate over `metadata` — from `feature-doc.ts`. That pulled the whole PR
pipeline into the page's bundle: the agent doc writer, both markdown
converters, `aqliSchema`, and ProseMirror behind it.

It lives in `lib/integrations/source/policy.ts` now, which imports nothing but
a type. Worth remembering as a shape: a small helper in a big module is a big
import.

### What is left, and is meant to be

`lib_supabase_agent-docs` still carries the markdown pipeline. That one is real
— agents write markdown and the server converts it — and it should not be
chased. `lib/markdown/schema.ts` deriving the editor schema and the serializer
from one list is what stopped tables and images being silently dropped; picking
it apart to save bundle would trade a correctness guarantee for KiB.

**922 KiB of headroom is enough to stop optimising.** The paid plan ($5/month,
10 MiB) is still the better answer if this gets tight again — Next's runtime is
~2 MiB before any product code, and that does not change.

---

## 4. GitHub is connected with a pasted token now

**Needs a human because:** existing GitHub connections stop working on deploy,
and no migration can fix that — the replacement credential is a token only the
workspace admin can create.

`@composio/core` is gone. It cost 294 KiB gzipped inside Cloudflare's 3 MiB
Workers limit, for OAuth, webhook delivery, and four REST calls, all of which
`lib/integrations/source/github.ts` now does with `fetch`.

**What an admin has to do, per workspace with GitHub connected:**

1. Create a token at `github.com/settings/tokens/new` with **`repo`** and
   **`admin:repo_hook`**.
2. Settings → Integrations → GitHub, paste it, re-select the repositories.

Until they do, PR merges stop creating docs. Nothing breaks loudly — the old
Composio triggers just stop having anywhere to deliver to.

**Old Composio triggers are not cleaned up.** They still exist in the Composio
account and will keep firing at `/api/integrations/composio/webhook`, which no
longer exists — the route files were removed, so the URL is a genuine 404. (An
earlier revision only commented the files out, which does not work: Next
registers a route for any `route.ts` under `app/`, so the endpoint kept
answering.) The code lives in
`lib/integrations/source/composio-routes.reference.ts`. Delete the triggers in
Composio, and cancel the account if nothing else uses it.

`/api/integrations/composio/policy` and `/simulate` are still live routes —
they never used the SDK.

**`integration_secrets` is service-role only.** It holds repo-scoped tokens, so
it has RLS on and deliberately **no policies** — that combination is what makes
it unreadable from any user session. `supabase/tests/integration_secrets.sql`
asserts it, including that no policy exists, because adding one "so the
settings page can check for a token" would hand every viewer a token.

**Linear enrichment is gone.** It ran entirely through Composio's toolkit and
had nothing to swap in. A PR mentioning `ABC-123` is still matched to the right
doc; the issue's title and description no longer reach the generated summary.
Restoring it needs a Linear API token of its own.

**The Composio code is commented, not deleted** — `lib/integrations/source/
composio.ts`, the four route files under `app/api/integrations/composio/`, and
the two functions it needed in `feature-doc.ts` and `integration-connections.ts`.
`composio_user_id` is still written on every connection so putting it back needs
no backfill. Restoring also needs `pnpm add @composio/core`.

Rollback: `rollback/20260809000000_github_direct_tokens.down.sql`, replayed
against a scratch database. It drops every stored token, which is not
recoverable — they were pasted in by hand and exist nowhere else.

---

## Running the tests

```bash
pnpm test        # unit — disposition, diff, markdown round-trip
pnpm test:sql    # SQL — boots a throwaway Postgres, replays every migration
```

`pnpm test:sql` needs a local `postgres` binary (`/usr/lib/postgresql/*/bin`)
or a `DATABASE_URL` pointing at a scratch database. Every test file runs in a
transaction and rolls back, so it is safe against a database you care about.

It had been failing since the doc-images work landed: `20260806010000` writes
to `storage.buckets`, which Supabase provides and a scratch cluster does not,
so the replay died before reaching any test. `tests/base.sql` now stubs the
`storage` schema with the columns those migrations touch.

To check the step-6 interlock still bites:

```bash
PGTEST_SKIP_GATE=1 pnpm test:sql
# -> ERROR: step 6 blocked: the body_md backfill has not run
```

---

## Verifying behaviour-neutrality

The digest used throughout — it should only change on `body_md` once the
backfill has deliberately rewritten it:

```sql
select md5(string_agg(id::text || '|' || coalesce(body_md,'') || '|' || updated_at::text,
                      ',' order by id)) as docs_digest,
       count(*) filter (where updated_at > now() - interval '1 hour') as recently_touched
from docs;
```

`recently_touched` must stay **0** after the backfill. If it is not, the trigger
fired and the document ordering has moved.

---

## Known gaps, recorded rather than papered over

- ~~**`review_all` has no UI.**~~ Closed. Settings → Spaces sets each space's
  `review_policy`, admin-only, and the option descriptions are written from
  `decideDisposition`. Existing spaces keep `review_agents`; nothing changes
  until someone chooses otherwise.
- ~~**Agent key scopes have no UI either.**~~ Closed. Settings → API keys sets
  scopes at creation and per key afterwards, admin-only. `read` is always
  included server-side (`normalizeScopes`), because a key without it does
  nothing.
- **`/api/agent/docs/[id]/review` is vestigial.** Since step 5 an agent gets
  review by having its proposal queued. The endpoint still flags a document's
  status so existing agents do not break, and the queue lists those documents
  under their own heading. Nothing creates new ones.
- **Direct writes to `docs` are still possible.** Spec §2.3's
  `documents_no_direct_write` policy is not in place, because
  `AQLI_MERGE_ENGINE=0` needs the direct path to exist. It becomes enforceable
  once that lever is retired.
- **The step-6 code has not been exercised against real data**, since the
  backfill has not run. The first thing to check after it does is that an
  existing document opens in the editor unchanged.
