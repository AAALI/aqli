# Moving a team from Confluence to Aqli

A playbook for the migration itself: what to do, in what order, and — said
plainly — which parts Aqli does not do yet. It is written for the person
running the move, not for a contributor. `docs/roadmap.md` is where the product is
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
| Confluence importer | Yes — `pnpm import`, or Settings → Import for a markdown zip. Attachments, cross-links and the page tree are carried across; a per-page report says what conversion could not represent. Unverified against a real export: see below. |
| Sub-pages (page tree) | Yes — parent pages, drag to re-parent or reorder, breadcrumbs, and `parent_id` on the agent API. |
| Per-space permissions | Yes — a space can be members-only, and the boundary holds in search, RAG and every assistant. |
| Email notifications | **Not built** — there is no mail transport. Mentions and review requests reach the in-app bell, and a chat webhook if you add one (Settings → Workspace). |
| Instance health | `pnpm preflight`, or Settings → Health, reports what an installation is missing. |
| Getting out again | `pnpm export`, or Settings → Import & export: markdown + images, and it imports back. |

The remaining gaps are the ones that decide whether you can move a whole
company or only a team. Read them before you promise anyone a date.

---

## 1. Stand up the instance

Bring your own Supabase project and OpenAI key, apply everything in
`supabase/migrations/`, and deploy (see `README.md`; the repo deploys to
Cloudflare Workers via OpenNext).

**Apply every migration, including the most recent, before you invite anyone.**
Some of them close gaps rather than add features — `20260808000000_doc_comments.sql`
puts row-level security on the comments table, and a database where it has not
run does not isolate comments between workspaces.

Then ask the instance about itself, rather than checking by hand:

```bash
pnpm preflight
```

It names any unapplied migration, any table serving rows without row-level
security, whether markdown is canonical yet, whether your approved docs are
embedded (an instance that answers nothing looks healthy from the outside), and
whether email confirmation is still off — with the fix for each. Admins without
a shell get the same report at Settings → Health. Fix everything it fails on
before the first invitation goes out.

Turn email confirmation **on** in Supabase → Auth → Providers. The README's note
about disabling it is for local development only, and preflight fails on it.

## 2. Decide your spaces and review policy

Spaces are the top-level division; inside one, pages nest up to eight levels.
Two consequences worth planning around:

- **Confidential content can move now.** Set a space to *Members only* in
  Settings → Spaces before you import into it, and only its members can read it
  — in the app, in search, and through any assistant, whose reads inherit the
  space membership of whoever owns its key. Being a workspace admin is not
  membership. The one deliberate exception is a workspace export, which is
  complete by design: the exit door cannot have rooms missing from it.
- **Map Confluence spaces to Aqli spaces one to one**, and let the page tree
  carry the hierarchy inside each. A subtree lives wholly inside one space —
  the database enforces it — so splitting a Confluence tree across two Aqli
  spaces means breaking it apart deliberately.

Then set each space's review policy:

| Policy | Who merges directly | Use it for |
|---|---|---|
| `open` | everyone, including agents | scratch spaces |
| `review_agents` *(default)* | humans; agent writes queue | most spaces |
| `review_all` | nobody — everything queues | policy and compliance |

## 3. Get the content across

Run the fidelity gate first, on your own export, before you let anything write:

```bash
pnpm confluence:fidelity --csv path/to/bodycontent.csv --out fidelity.md
```

It exits non-zero when more than 2% of pages fail the round-trip gate. Read
*Macros with no handler*, *Elements with no handler*, and the worst pages by
retention. **Tables are the known weak point:** colspan, rowspan and cell
alignment cannot be represented in GFM, so table-heavy pages degrade and belong
on a manual list rather than blocking the run.

Then import. A dry run is the default — it writes nothing and produces the same
report an apply would:

```bash
unzip "Your Space Export.zip" -d ./confluence-export
pnpm import --workspace <slug> --dir ./confluence-export \
            --space-map HR=handbook,ENG=engineering \
            --authors ./confluence-export/entities/user_mapping.csv
pnpm import --workspace <slug> --dir ./confluence-export --space-map … --apply
```

A zip of markdown — a Notion export, a docs repo, another wiki's output — goes
through the same pipeline, and is small enough to do from the browser at
Settings → Import.

What the import does for you, so you do not have to check it by hand:

- **Images are uploaded and re-linked** to the authenticated `/api/images/<path>`
  form, so canonical markdown never holds a link that expires.
- **Cross-references are resolved** to the documents those pages became. A link
  to a page that was not in the export keeps its words and is listed in the
  report rather than left dead.
- **The page tree is preserved**, parents and all.
- **Pages arrive approved**, with the staleness clock starting at import — which
  turns "review 400 pages" into a queue rather than a wall.
- **Re-running is safe.** Import keys on the source page id, and the database
  has a unique index on it: a second run updates, it cannot duplicate.
- **Nothing disappears quietly.** Unhandled macros, attachments that are not
  images (the bucket takes PNG, JPEG, GIF and WebP), unresolved links and
  unmatched authors are all named against their page in the report, which lands
  as a document in the workspace.

Two things to know before you trust a large run:

- **The Confluence adapter has not been run against a real space export.** It
  detects its column names rather than assuming one Confluence version's layout,
  and reports which it found — if your tree comes out flat, that list is the
  first thing to read. Do a dry run on the real export before promising anyone
  a date.
- **An author who is not in `user_mapping.csv` loses their attribution**, and
  nothing is written into the document body: a mention is not a doc-body node
  here, and an import must not invent one.

Finish with a cleanup pass over the imported tree — normalise headings, fix
macro residue, verify images render. The report is your checklist, and this is a
good job for an assistant connected over MCP.

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

- **Notifications are in-app or chat, not email.** Add a Slack, Teams or
  Discord incoming-webhook URL in Settings → Workspace before the pilot starts,
  or mentions and review requests will only be found by people who open the app
  that day. There is no email leg at all.
- **Nothing pins a page to the top of a space.** The tree orders siblings, but
  a "start here" convention still has to be a title or a pinned link.

Then cut over: make Confluence **read-only** rather than deleting it, keep it
that way for about a month, and run `pnpm export` once before you cancel
anything — proving the exit door works while you still have both. Keep that
archive: it is a complete copy of the workspace, readable without Aqli, and it
imports into a fresh instance.

## What to check before you call it done

- [ ] Every page a team still uses exists in Aqli, in the right space, with images intact.
- [ ] Everyone has an account and has signed in at least once.
- [ ] A non-technical teammate can find, edit, illustrate and comment on a page unassisted.
- [ ] Editing a doc produces a revision that a person can view and revert from.
- [ ] An assistant can answer from approved docs, and cannot publish without review.
- [ ] A full markdown + images export has been produced and stored (`pnpm export`).
- [ ] Anything confidential landed in a space set to *Members only*, with its roster filled in before the import ran.
