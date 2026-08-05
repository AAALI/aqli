# Handover — steps that need a human

Two things could not be completed in the agent sandbox. Both are blocked on inputs that live
outside it, not on unfinished work: the code for each is written, typechecked and committed.

---

## 1. Run the fidelity gate against the real Confluence export

**Blocked on:** `Tabadulat Platform Confluence Export.zip` is not present in this environment.

This is the brief's highest-priority deliverable — worth more than steps 1 and 3 combined —
and the committed report currently covers a *synthetic* corpus generated to the same page count
and macro mix. That proves the harness works. It does not answer the question, because
synthetic content has none of the malformed markup and one-off macros that make a real export
worth running.

```bash
unzip "Tabadulat Platform Confluence Export.zip" -d /tmp/confluence
pnpm confluence:fidelity --csv /tmp/confluence/entities/bodycontent.csv \
                         --out reports/confluence-fidelity.md
```

The CSV's column layout differs between Confluence versions, so the body and id columns are
detected from the header rather than assumed. If detection misses, the columns are resolved in
`locateColumns` in `scripts/confluence-fidelity.ts`.

**What to look at.** The command exits non-zero if more than 2% of pages fail the round-trip
gate — the brief's stop-and-report threshold. Also read:

- *Macros with no handler* and *Elements with no handler*. Anything frequent there is a gap in
  `lib/confluence/storage-to-md.ts`.
- *Worst pages by retention*. Spot-check the worst 20 by eye; a low score is usually a dropped
  macro body, which the round-trip check alone cannot see.
- **Tables specifically.** Alignment, colspan and rowspan are unrepresentable in GFM and the
  export has 7,613 tables. If real pages depend on merged cells, that content degrades
  silently and it is the weakest point in the allowlist.

---

## 2. Backfill `body_md` from `body_json`

**Blocked on:** `SUPABASE_SERVICE_KEY`. It is held in Cloudflare and is not reachable from the
sandbox; the Supabase connector available here exposes only publishable keys.

`body_text` and `headings` are already populated for every document and are maintained by the
`docs_maintain_derived` trigger, so they stay correct regardless of which path writes a row.
`body_md` still holds output from the old hand-rolled converter.

```bash
export SUPABASE_URL=https://bxhagsiaenvcksckhize.supabase.co
export SUPABASE_SERVICE_KEY=...        # from Cloudflare

pnpm backfill:markdown                 # dry run — writes nothing
pnpm backfill:markdown -- --apply      # writes, after you have read the dry run
```

**What it does.** Regenerates `body_md` from `body_json` with the new serializer, gated on the
round-trip test passing for that document. A document that fails the gate is logged and skipped,
never written — replacing good markdown with a lossy version is the one outcome worse than
leaving it alone. The report lands in `reports/markdown-backfill.md`.

**Expected result.** Measured in SQL beforehand: 27 of 80 documents contain text in `body_json`
that the old converter dropped — 87 words total, worst case 8 — mostly identifiers from code
spans, table cells and nested list items (`20260610010000`, `snake_case`, `supabase_realtime`).
The backfill recovers them. Expect 0 gate failures; if any document fails, that is a finding
worth reporting before step 6, not something to force through.

**Why `updated_at` is written back explicitly.** The trigger sets it to `now()` on every write
and the document list is ordered by it, so a backfill that let the trigger fire would reshuffle
every list in the app. This bit me once already in step 1 and is now handled in both the
migration and this script.

---

## Verifying afterwards

The behaviour-neutrality check used throughout — the digest should only change on the
`body_md` column once the backfill has deliberately rewritten it:

```sql
select md5(string_agg(id::text || '|' || coalesce(body_md,'') || '|' || updated_at::text,
                      ',' order by id)) as docs_digest,
       count(*) filter (where updated_at > now() - interval '1 hour') as recently_touched
from docs;
```

`recently_touched` must stay **0** after the backfill. If it is not, the trigger fired and the
document ordering has moved.

---

## Not done, and deliberately so

- **No draft PR after step 1**, which the brief's working agreement asks for. Say the word.
- **Branch is `claude/document-review-supabase-lr6o0n`**, mandated by this environment rather
  than `migration/markdown-canonical`.
