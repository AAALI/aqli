# Can markdown be Aqli's source of truth?

Report on steps 1–3 of the markdown-canonical migration.
Branch `claude/document-review-supabase-lr6o0n`. Measured against a live production project.

---

## The answer

**Yes, with two caveats worth knowing before you commit the next three weeks.**

The evidence is below. The short version: markdown represented everything thrown at it, but
getting there took eleven real defects out of the converters, and *none* of them would have
been found by the tests I would have written by hand. The property test and the corpus found
all eleven. That is the finding I'd act on — not "markdown works", but "markdown works if you
keep the gate, and the gate has to be adversarial or it is worthless".

### Caveat 1 — the corpus run is not the real one

The brief's highest-priority deliverable is the fidelity report over the 1,361-page Confluence
export. **That export is not present in this environment**, and I could not obtain it. The harness is built, committed and proven, and the committed report
covers a synthetic corpus generated to the same page count and macro mix from the spec §8
census.

That demonstrates the pipeline. It does not answer the question. Synthetic content cannot
contain the malformed markup, encoding oddities and one-off macros that make a real export
interesting — which is exactly what the gate exists to find. See `HANDOVER.md`; it is one
command once the file is available.

### Caveat 2 — the editor could produce things markdown cannot, and did

`StarterKit` ships an `underline` mark. Markdown has no underline. Today that is harmless
because `body_json` is canonical. **After the flip it is silent, permanent data loss on every
save.** It is now disabled at the schema level.

That is the general shape of the risk, and it is why the allowlist has to be derived from one
definition rather than maintained in parallel. `lib/markdown/schema.ts` is that definition; the
serializer asserts completeness against it at import time, so adding a node to the editor
without teaching the serializer about it fails the build rather than losing content at runtime.

---

## What round-trips cleanly

Everything in the spec §4.1 allowlist, verified two ways.

**Property test** (`lib/markdown/__tests__/round-trip.test.ts`, `fast-check`):

| Input | Runs | Result |
|---|---|---|
| Well-formed markdown | 40,000 | Fixed point after exactly one pass, 100% |
| Deliberately malformed markdown | 40,000 | Always converges; 39,996 in one pass, 4 in two |

Plus 54 named adversarial fixtures: nested lists inside blockquotes, code fences containing
markdown and containing fences, tables with pipes and marks in cells, links with parentheses,
mixed and nested inline marks, every callout kind, task lists, hard breaks, and text made
entirely of markdown metacharacters.

**Corpus gate** (synthetic, 1,361 pages): 100% fixed point, 0 conversion errors, mean text
retention 99.92% (p01 98.75%, min 97.96%). The residual is attachment filenames appearing in
URLs rather than prose — a measurement artefact, not lost content.

---

## What does not round-trip, and what it cost to get there

Eleven defects, each found by the generators rather than by inspection, each now pinned as a
named regression test. Listing them because the pattern matters more than the individual bugs.

| # | Defect | Consequence had it shipped |
|---|---|---|
| 1 | Dropped inline content left stranded whitespace | Paragraph text shifted on every save |
| 2 | Empty paragraph ProseMirror inserts to satisfy `listItem`'s `paragraph block*` | Everything after a list marker detached from its item |
| 3 | Adjacent sibling lists sharing a bullet | Two lists silently merged into one |
| 4 | Nested list sharing its parent's bullet | `- - -` read as a thematic break, not three lists |
| 5 | `---` directly under a callout marker | `[!NOTE]` became an h2; the callout vanished |
| 6 | Inline code losing a space from each end | `` ` x ` `` lost its spaces on every save |
| 7 | Code fence info string carrying backticks | Fence corrupted, rest of document reinterpreted |
| 8 | Heading's trailing `#` read as a closing sequence | `# #` came back as an empty heading |
| 9 | `+` or `0.` alone on a line | Became an empty list item, then was dropped entirely |
| 10 | Under-escaped runs of underscores | `__A__` re-paired as emphasis |
| 11 | Confluence: self-closing `<ac:… />` and CDATA | One `toc` macro swallowed a whole page; every code block emptied |

Number 11 is the one I'd point at. `rehype-parse` is an HTML parser and Confluence bodies are
XHTML: HTML has no self-closing syntax for unknown elements, so `<ac:structured-macro
ac:name="toc" />` was read as an *opening* tag and consumed the rest of the page — which the
toc handler then dropped. CDATA is a bogus comment in HTML, so all 2,394 code macro bodies came
back empty. Mean retention went from 86.98% to 99.92% once both were repaired. Neither is
visible in a unit test you would think to write; both are obvious the moment you run a corpus.

### Known lossy edges, accepted deliberately

None required a custom markdown extension — the brief flagged that as a design-failure signal
and it did not fire. These are normalizations, documented rather than hidden:

- **Headings below h3** clamp to h3. The allowlist stops at 3.
- **Table cells** flatten to a single line and lose alignment, colspan and rowspan. GFM pipe
  tables cannot express any of it. A cell holding multiple paragraphs cannot survive.
- **A thematic break as the first block of a list item** is dropped. `- ****` has no markdown
  spelling; indenting `---` under a marker reads as a top-level break on the way back in.
- **Empty list items** are dropped. They serialize to a bare marker, which the next parse
  absorbs as literal text.
- **Prose underscores are escaped** (`snake\_case`). Identifiers inside code spans are not
  touched, which is where they almost always live.
- **Thematic breaks are written `***`**, not `---`, so they can never be read as a setext
  underline or confused with a frontmatter fence.

---

## Behaviour neutrality

Demonstrated, not asserted. The check is a digest over every document's `id`, `body_md` and
`updated_at`:

| Point | Digest |
|---|---|
| Before any migration | `ceb9ac43d06a62754c79ef70ce96b1a5` |
| After step 1 (schema) | `ceb9ac43d06a62754c79ef70ce96b1a5` |
| After step 3 (revisions) | `ceb9ac43d06a62754c79ef70ce96b1a5` |

Four search probes returned identical hit counts either side of the `search_vector` change
(`webhook` 12, `payment retry` 1, `holiday policy` 1, `composio` 9).

**One thing nearly slipped through, and it is worth recording.** The step-1 backfill fired the
existing `docs_search_vector_update` trigger, which also sets `updated_at := now()`. All 83
documents were stamped with the same timestamp, and the document list is ordered by
`updated_at desc` — so every list in the app would have been silently reshuffled. I had the
pre-migration values, restored them, and both the committed migration and the step-3 backfill
now suspend the trigger around bulk writes. Without the digest check I would not have noticed.

---

## Step 2.5 — the one thing not finished

`body_text` and `headings` are populated for every document and maintained by a trigger, so
they stay correct no matter which path writes the row. **`body_md` has not been regenerated
from `body_json`.**

Running it requires `SUPABASE_SERVICE_KEY`, which lives in Cloudflare and is not reachable from
this sandbox. The script is written, typechecked and committed
(`scripts/backfill-markdown.ts`, dry-run by default). See `HANDOVER.md`.

I measured what it will recover, in SQL, without moving the data: **27 of 80 documents contain
text in `body_json` that the old converter dropped** — 87 words in total, worst case 8. They
are identifiers from code spans, table cells and nested list items: `20260610010000`,
`snake_case`, `supabase_realtime`, `rel`/`type`/`href`. Small in volume, but it confirms the
brief's premise directly: the old converter loses real content, and after the flip that loss
would be permanent.

---

## Recommendation

**The markdown-canonical decision holds. Proceed to step 4.**

Three things I would insist on carrying forward:

1. **Keep the round-trip gate in CI, and keep it adversarial.** It found eleven defects. A gate
   that only checks clean input would have found none of them and produced exactly the false
   confidence the brief warns about.
2. **Run the real corpus before step 6.** Step 6 is the one-way door. The synthetic run proves
   the harness, not the decision. This is a few hours of work and it is the last cheap moment
   to discover a hole.
3. **Treat the schema allowlist as load-bearing.** The `underline` mark was in the editor for
   months. The import-time assertion is what stops the next one.

### Not acted on, per the brief — but worth saying once

- **`packages/markdown` as a shared package (spec §10.5).** It is still `lib/markdown` in the
  web app. Everything that emits markdown must produce byte-identical output or the gate is
  meaningless, and the MCP server and ingest worker are separate deployables. Extracting it is
  mechanical now and gets harder once three things import it.
- **Table fidelity is the weakest point in the allowlist.** Alignment, colspan and rowspan are
  unrepresentable, and Confluence has 7,613 tables. If any real page depends on merged cells,
  that content degrades silently. Worth spot-checking in the real corpus run specifically.

### Deviations from the brief

- **Branch.** `claude/document-review-supabase-lr6o0n`, mandated by this environment, not
  `migration/markdown-canonical`.
- **No draft PR after step 1.** Not opened; say the word and I will.
- **Table names.** The spec says `documents` and `agent_keys`; the repo has shipped `docs` and
  `api_keys` since its first migration. Renaming belongs to the step-6 flip, so the existing
  tables keep their names and the new tables use the spec's column names (`document_id`) to
  make that rename mechanical.
- **`documents_no_direct_write` (spec §2.3) not applied.** Editors still write `docs` directly
  today; adding it now would break the editor. It belongs with the merge engine in step 4.
