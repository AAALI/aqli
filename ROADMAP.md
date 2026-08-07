# Aqli Roadmap — from eng docs tool to company knowledge base

> **Where we're going:** the open source company knowledge base that replaces
> Confluence — usable by every team, connected to every AI assistant, trusted
> because humans verify what's in it.
>
> **The wedge:** Confluence's biggest failure is rot — nobody trusts old pages.
> Aqli's review loop, freshness verification, and AI-readable approved context
> attack that directly. We don't chase Confluence feature parity; we clear the
> usability baseline, then press the AI-native advantage.

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
3. **Comments & @mentions.** New `doc_comments` table; inline anchors optional
   at first — start with doc-level comments + mentions with email notification.
   This is how review feedback happens for people who don't use GitHub.
4. **Import.** Markdown/zip first (cheap, also serves eng), then Notion export,
   then Confluence space export (XML). Nobody re-types their handbook.
5. **Sub-pages.** `parent_doc_id` on docs; tree rendering in space sidebar with
   drag to reorder. Confluence users think in trees (Benefits → Leave →
   Parental leave).
6. **Space-level permissions.** `space_members` table + RLS; private spaces for
   People/Finance/Legal. Blocks real HR adoption until it exists.

Ship 1–2 as one release ("the editor holds real content now"), 3–4 next, 5–6 after.

## Phase 3 — Press the AI-native advantage

What makes Aqli the *reason to switch*, not just a cheaper Confluence:

1. **MCP server.** Expose the agent API (query context, draft doc, request
   review) as MCP tools so Claude, ChatGPT, Cursor — anyone's AI — connects in
   minutes. "Open source Confluence with MCP" is an ownable position, and it
   makes the AI story real for non-technical users whose "agent" is Claude in a
   browser, not a CI pipeline.
2. **Slack integration.** Ask-the-handbook Q&A bot (RAG over approved docs) +
   "save this thread as a draft doc". This is the non-eng equivalent of the PR
   pipeline: knowledge capture where the work already happens.
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
