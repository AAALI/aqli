# Moving a team from Confluence to Aqli

A playbook for the migration itself: what to do, in what order, and — said
plainly — which parts Aqli does not do yet. It is written for the person
running the move, not for a contributor. `ROADMAP.md` is where the product is
going; this is how you get a team across today.

Aqli's own bet is worth naming up front, because it changes what "migrated"
means: documents carry an approval state, and assistants write proposals rather
than pages. You are not just moving text — you are deciding what your company
treats as reviewed.

---

## Know before you start

| | Where it stands |
|---|---|
| Markdown is canonical | Yes. `body_md` is the source of truth; export is lossless by construction. |
| Page history | Yes — one revision per merged change. |
| Comments, @mentions | Yes, doc-level, with the review trail in the same thread. |
| Images | Yes — paste and drag-drop, stored per workspace behind an authenticated route. |
| Tables, Mermaid diagrams | Yes. |
| Agent access | REST API and an MCP server (`/api/mcp`). |
| **Confluence importer** | **Not built.** The converter exists (`lib/confluence/storage-to-md.ts`) and a fidelity gate exists; the ingest surface and attachment/link resolution do not. See below. |
| **Sub-pages (page tree)** | **Not built.** Documents are flat within a space. |
| **Per-space permissions** | **Not built.** Anyone in the workspace can read any space. |
| **Email notifications** | **Not built.** Mentions and review requests reach people through the in-app bell only. |

The last four are the ones that decide whether you can move a whole company or
only a team. Read them before you promise anyone a date.

---

## 1. Stand up the instance

Bring your own Supabase project and OpenAI key, apply everything in
`supabase/migrations/`, and deploy (see `README.md`; the repo deploys to
Cloudflare Workers via OpenNext).

**Apply every migration, including the most recent, before you invite anyone.**
Some of them close gaps rather than add features — `20260808000000_doc_comments.sql`
puts row-level security on the comments table, and a database where it has not
run does not isolate comments between workspaces. If you have an instance that
has been running for a while, check that it is not behind:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('docs', 'doc_comments', 'proposals');
```

Turn email confirmation **on** in Supabase → Auth → Providers. The README's note
about disabling it is for local development only.

## 2. Decide your spaces and review policy

Spaces are the top-level division and, for now, the only one — no page tree, no
per-space privacy. Two consequences worth planning around:

- **Do not migrate anything confidential yet.** Every workspace member can read
  every space. HR, finance and legal content should wait for per-space
  permissions.
- **Prefer more spaces to deep hierarchies**, since hierarchy does not exist
  yet. A Confluence tree flattens into one space; if a section is big enough to
  have its own tree, give it its own space.

Then set each space's review policy:

| Policy | Who merges directly | Use it for |
|---|---|---|
| `open` | everyone, including agents | scratch spaces |
| `review_agents` *(default)* | humans; agent writes queue | most spaces |
| `review_all` | nobody — everything queues | policy and compliance |

## 3. Get the content across

There is no one-click import. Two routes, and it is worth running both once on
a sample and comparing:

**Export via the Atlassian REST API.** Tools such as
[`confluence-markdown-exporter`](https://github.com/Spenhouet/confluence-markdown-exporter)
walk a whole space, download attachments and re-link them, and handle common
macros. If your Confluence is still live, this usually beats parsing an export
archive, whose storage format is undocumented and drifts.

**Or convert the space export with the in-repo converter.** `lib/confluence/storage-to-md.ts`
handles the macros and elements a real corpus actually contains, and
`scripts/confluence-fidelity.ts` reports what a conversion would lose before you
commit to it:

```bash
pnpm confluence:fidelity --csv path/to/bodycontent.csv --out fidelity.md
```

It exits non-zero when more than 2% of pages fail the round-trip gate. Read
*Macros with no handler*, *Elements with no handler*, and the worst pages by
retention. **Tables are the known weak point:** colspan, rowspan and cell
alignment cannot be represented in GFM, so table-heavy pages degrade and should
go on a manual list rather than blocking the run.

Either way you are writing the ingest yourself today. Two things to get right:

- **Images must not arrive as expiring links.** Upload them to the doc-images
  bucket and reference the authenticated `/api/images/<path>` form, so canonical
  markdown stays valid forever.
- **Import as `approved`, not `draft`.** These pages were your team's working
  truth. Land them approved and let the staleness detector surface them for
  re-verification over time — that turns "review 400 pages" into a queue rather
  than a wall.

Make the importer idempotent (key on the Confluence page id) so a re-run fixes
rather than duplicates.

Finish with a cleanup pass over the imported tree — normalise headings, fix
macro residue, verify images render. This is a good job for an assistant
connected over MCP.

## 4. Connect your assistants

```bash
claude mcp add --transport http aqli https://your-aqli.app/api/mcp \
  --header "Authorization: Bearer aqli_your_key"
```

Create the key from Settings → API keys. Give it `read` and `propose`, not
`write`: with `propose`, everything an assistant writes queues for a person, and
approving it is one click. `write` lets an assistant merge into `open` and
`review_agents` spaces without review — reserve it for pipelines you already
trust, such as an ingester replaying changes a human reviewed elsewhere.

Keys are per-integration, not per-company: one key per assistant or pipeline
means the AI activity log tells you which one acted. Pass `on_behalf_of` on
writes so the review queue also shows which person asked.

## 5. Pilot before you cut over

Pick two teams, migrate their spaces, and have them work only in Aqli for two
weeks. Watch for the failure that matters: a non-technical teammate who cannot
find, edit, or illustrate a page will quietly go back to whatever they used
before, and you will not hear about it.

Two friction points to expect, since neither has a fix in the product yet:

- **Notifications are in-app only.** If your team lives in chat and does not
  visit the app daily, mentions and review requests will be missed. A webhook
  from your own side is the usual stopgap.
- **No page tree.** Teams that thought in nested pages will need the space and
  a clear title convention to compensate.

Then cut over: make Confluence **read-only** rather than deleting it, keep it
that way for about a month, and export your Aqli workspace to markdown once
before you cancel anything — proving the exit door works while you still have
both.

## What to check before you call it done

- [ ] Every page a team still uses exists in Aqli, in the right space, with images intact.
- [ ] Everyone has an account and has signed in at least once.
- [ ] A non-technical teammate can find, edit, illustrate and comment on a page unassisted.
- [ ] Editing a doc produces a revision that a person can view and revert from.
- [ ] An assistant can answer from approved docs, and cannot publish without review.
- [ ] A full markdown + images export has been produced and stored.
- [ ] Nothing confidential was migrated ahead of per-space permissions.
