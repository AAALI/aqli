# Aqli Roadmap — from eng docs tool to company knowledge base

> **Where we're going:** the open source company knowledge base that replaces
> Confluence — usable by every team, connected to every AI assistant, trusted
> because humans verify what's in it.
>
> **The wedge:** Confluence's biggest failure is rot — nobody trusts old pages.
> Aqli's review loop, freshness verification, and AI-readable approved context
> attack that directly. We don't chase Confluence feature parity; we clear the
> usability baseline, then press the AI-native advantage.
>
> **Companion docs:** `ADOPTION.md` says what has to be true before a company
> can turn its old wiki off, with acceptance criteria per feature — it is where
> the items below get their detail. `docs/moving-from-confluence.md` is the
> playbook for the person running a move.

## Competitive reference points

- **Confluence** — the incumbent. Wins on editor, page tree, comments,
  permissions, ecosystem. Loses on rot, clunky approvals, closed platform, price.
- **GitBook** (`gitbook.com/solutions/knowledge-base`) — "product-quality" docs,
  AI assistant that answers from the wiki, granular page-level permissions.
  Their pitch order: centralize → AI discoverability → governance. Closed source.
- **Agent-Native** (`github.com/BuilderIO/agent-native`) — open source, same
  architecture as us (Tiptap editor, markdown-canonical storage, agent and human
  writing through one pipeline). Ahead of us on editor (tables, images, slash
  blocks), page tree with infinite nesting, Yjs real-time collaboration, Notion
  two-way sync, page-level sharing, MDX components. Worth reading their editor
  code before building ours. Notably: **no diagrams** — neither has Mermaid
  support. That's our opening.

---

## Phase 1 — Remove the engineering spine ✅ (shipped July 2026)

Make the product make sense to a Head of People on day one.

- [x] Onboarding: default only a **Company** space; team-neutral space
  suggestions (Marketing, Sales, People, Ops…); custom space input; AI-assistant
  framing instead of API-key framing.
- [x] DB: `create_workspace_for_user` seeds only the Company space.
- [x] Doc types: General is the default; team-neutral types (How-to, Policy,
  Meeting notes, Brief, Decision) listed before eng types (PRD, ADR, Runbook,
  Fix note, Compliance), each with a starter template.
- [x] **Diagrams (Mermaid)** — `/diagram` slash command, live preview in the
  editor, rendered diagrams in the read view. Diagrams live in ```mermaid code
  fences, so they round-trip through `body_md` and **agents can write them
  natively in markdown**. Covers flowcharts, sequence, state, Gantt — the RFC /
  PRD / ops-workflow use cases.
- [x] GitHub/PR chrome (badges, headlines, copy) hidden unless the GitHub
  integration is actually connected.
- [x] Vocabulary: "Stale docs" → "Needs updating", "Agent log" → "AI activity".

## Phase 2 — Table stakes for a company knowledge base

The adoption gates a non-eng team hits in week one. In priority order:

1. - [x] **Images in the editor.** Tiptap Image extension + Supabase Storage
   bucket (workspace-scoped, RLS on storage paths). Paste and drag-drop upload.
   Markdown: `![alt](url)`. Nothing else matters until screenshots paste.
   *Shipped. The URL in `body_md` is `/api/images/<path>`, served by an
   authenticated route — canonical markdown cannot hold a link that expires.
   Storage migrations applied to production and verified.*
2. - [x] **Tables.** Tiptap Table extension + a `/table` slash command. Markdown
   round-trip: GFM tables in `tiptap-to-md` and `md-to-tiptap` (agents need to
   read and write them). *Shipped, with row/column controls — a table is the
   one node with no keyboard spelling.*

   Both required repairing the schema first: the editor and the read view each
   mounted a hand-rolled StarterKit instead of the allowlist, so a document
   with a table failed to load and saving deleted it; and `Image` was a block
   node, which meant markdown images were dropped along with their paragraph.
   The round-trip gate missed both because it only asserted stability, never
   preservation. An eslint rule now keeps the editor on one schema.
3. - [x] **Comments & @mentions.** Doc-level thread under the doc body, with an
   `@` menu over workspace members. *Shipped.* Notes on what it is and is not:

   `doc_comments` already existed — it predates the migrations folder, and the
   review path has written rejection reasons into it since day one. Nothing
   read them back, so a reviewer's "sent back because X" reached the author as
   a doc silently returning to draft. The thread now shows the review trail and
   ordinary comments together, because to a reader they are one conversation.
   Review-trail entries cannot be deleted by anyone, including admins.

   The table also had **no RLS** — under PostgREST that meant any authenticated
   user could read every comment in every workspace. `20260808000000` adds the
   policies, and `supabase/tests/doc_comments.sql` asserts the tenant boundary.

   Mentions are stored in the comment body as `@[Name](user:<uuid>)` and
   resolved server-side against the member list, so naming a uuid that is not a
   member notifies nobody. They are deliberately **not** in the doc body: a
   mention node in `lib/markdown/schema.ts` would be one more thing `body_md`
   has to round-trip, and the allowlist exists to keep that set small.

   **No email.** The repo has no mail transport, and adding one is its own
   piece of work. Delivery is the notification bell, which grew a `mention`
   kind. Inline anchors are still not built.
4. **Import.** Markdown/zip first (cheap, also serves eng), then Notion export,
   then Confluence space export (XML). Nobody re-types their handbook.
   One pipeline behind a source-adapter contract, because the hard parts are
   the same for every source: attachments into the images bucket as
   authenticated links, internal links resolved to imported doc ids, authors
   mapped to members (unmapped ones become plain text, never mention nodes),
   docs landing **approved** with the staleness clock starting at import, and
   idempotency keyed on the source page id. Two ingest surfaces — a CLI for
   self-hosters and an admin upload UI, since a hosted customer has no shell.
   Detail and acceptance in `ADOPTION.md` F-1.
5. - [x] **Sub-pages.** `parent_doc_id` + `position` on docs; tree rendering in the
   space sidebar with drag to reorder and re-parent. *Shipped: a Pages tab on
   the space view (the default once a space has a tree), drag to re-parent or
   reorder with the browser's own drag API rather than a dependency,
   breadcrumbs on the doc view, the parent in search results, and `parent_id`
   across the agent API and MCP.* Confluence users think in trees (Benefits →
   Leave → Parental leave). The cycle guard and depth cap are in the database,
   not the UI, because four write paths reach the same table; deleting a parent
   re-parents its children rather than orphaning or cascading. Import needed
   this first, which is why `ADOPTION.md` F-3 sits ahead of it.
6. **Space-level permissions.** `space_members` table + RLS; private spaces for
   People/Finance/Legal. Blocks real HR adoption until it exists. The boundary
   has to hold in every read path — docs list, doc view, search, RAG,
   notifications, review queue, backlinks, activity, REST and every MCP tool —
   with the agent path inheriting the key owner's visibility. That last rule is
   what keeps assistant answers leak-free (`ADOPTION.md` F-4).
7. **Workspace export.** Markdown + images as a zip, from Settings and the CLI,
   re-importable through the markdown adapter. Markdown is already canonical,
   so the export is lossless by construction — what is missing is the button,
   and the button is what makes the claim checkable during an evaluation
   (`ADOPTION.md` F-6).
8. **Install preflight.** One command and one admin view reporting unapplied
   migrations, any table with RLS off, recorded migration gates, and merge-engine
   state. Self-hosters currently learn this from `reports/HANDOVER.md` or not at
   all, and the failure mode is silent (`ADOPTION.md` F-0).

Ship 1–2 as one release ("the editor holds real content now"), 3–4 next, 5–6
after; 7–8 are small and can ride along with whichever release is moving.

Item 4 is cheaper than it looks: `lib/confluence/storage-to-md.ts` and
`scripts/confluence-fidelity.ts` already exist, so what is missing from
Confluence import is the ingest surface, not the converter. The fidelity gate
has still never run against the real export — see `reports/HANDOVER.md` §2.

## Phase 3 — Press the AI-native advantage

What makes Aqli the *reason to switch*, not just a cheaper Confluence:

1. - [x] **MCP server.** Expose the agent API (query context, draft doc, request
   review) as MCP tools so Claude, ChatGPT, Cursor — anyone's AI — connects in
   minutes. *Shipped: `POST /api/mcp`, stateless JSON-RPC, six tools, bearer
   auth on the existing API keys. Hand-rolled rather than built on
   `@modelcontextprotocol/sdk` — the worker has a hard size limit and the
   protocol surface a stateless server needs is four methods (+11.7 KiB
   gzipped). Scope enforcement had to move up a layer: the merge engine decides
   merge-vs-queue but never refuses, so a `read`-only key could queue
   proposals.* "Open source Confluence with MCP" is an ownable position, and it
   makes the AI story real for non-technical users whose "agent" is Claude in a
   browser, not a CI pipeline. What is left after the server is discovery:
   Settings → API keys reveals a snippet naming `/api/agent` and should name
   `/api/mcp` beside it. Until it does, connecting an assistant means reading
   the README, and a rollout that needs an engineer per assistant is one only
   engineering completes (`ADOPTION.md` F-2).
2. **Notification reach, then Slack.** Mentions and review requests reach people
   through the in-app bell only, and a team that lives in chat will miss them.
   The cheap, chat-agnostic fix first: an outbound webhook per workspace on
   mentions and review-queue events, which serves Slack, Teams and Discord
   equally. Then the richer Slack integration — ask-the-handbook Q&A bot (RAG
   over approved docs) + "save this thread as a draft doc". That is the non-eng
   equivalent of the PR pipeline: knowledge capture where the work already
   happens.
3. **Human review workflows.** Assigned reviewers, per-space approval rules
   (Legal approves Policy docs), scheduled re-verification cadences per doc type.
   *Partly here already: Settings → Spaces turns on `review_all`, so a space
   can require approval for every change including a human's. What is missing
   is naming who approves.*
4. **Public/shared docs.** Publish a doc or space read-only via share link —
   handbook pages, customer-facing docs. (GitBook's bread and butter.)

## Explicit non-goals (for now)

- Real-time co-editing (Yjs). Big lift, not the wedge. Autosave + versions is
  acceptable until multi-editor conflicts actually bite.
- Whiteboards, databases-in-docs, macro ecosystems. That's chasing Notion and
  Confluence onto their home turf.
- Per-page permissions. Space-level is enough until a real customer says
  otherwise.

## Sequencing logic

Phase 1 makes the product *not offend* a non-eng evaluator. Phase 2 makes it
*usable* for their real work. Phase 3 makes it *chosen*. Resist reordering:
an MCP server demos beautifully, but if the marketer still can't paste a
screenshot, the trial dies in week one.
