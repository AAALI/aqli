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

**`20260806010000_doc_images_storage.sql` is not part of this order.** It
creates the `doc-images` bucket and its RLS policies — it touches only
`storage` and reads `public.members`, so it neither depends on the backfill nor
blocks it, and it can be applied whenever. Images in the editor do not work
until it has been.

Rollback files for each migration are in `supabase/migrations/rollback/`. The
step-6 one restores the schema but not the data: once the app has been writing
markdown-first, no migration can reconstruct what was only in the markdown.

---

## Running the tests

```bash
pnpm test        # unit — disposition, diff, markdown round-trip
pnpm test:sql    # SQL — boots a throwaway Postgres, replays every migration
```

`pnpm test:sql` needs a local `postgres` binary (`/usr/lib/postgresql/*/bin`)
or a `DATABASE_URL` pointing at a scratch database. Every test file runs in a
transaction and rolls back, so it is safe against a database you care about.

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
