# Aqli — Product Documentation

> The open source shared context layer for human-agent teams.

---

## Document Index

1. [Product Requirements Document (PRD)](#1-product-requirements-document)
2. [Technical Architecture](#2-technical-architecture)
3. [Repository Structure & Build Package](#3-repository-structure--build-package)

---

# 1. Product Requirements Document

## Problem Statement

Teams building with AI agents have no shared, structured knowledge base that both humans and agents can read from and write to reliably. Existing tools — Confluence, Notion, Outline — were designed for human-only authorship. They have no native concept of agent-authored content, no structured API for agents to query context before acting, no approval workflow for agent-generated docs, and no consistent schema that makes docs machine-readable without brittle prompt engineering.

The result: agents hallucinate context, work from stale system prompts, produce undocumented output, and have no memory between runs. Teams end up with scattered knowledge across Notion, Slack threads, GitHub comments, and verbal agreements. Nothing is trusted. Nothing is current. Nothing is searchable by both humans and agents.

This problem gets worse as teams add more agents. Aqli solves it.

---

## Product Vision

> Aqli is the team knowledge base built for the reality that your team now includes both humans and AI agents. A single place where humans write docs, agents read context, agents write output, and humans review and approve — all in one structured, searchable, hosted system.

---

## Goals

1. **Human writing experience is as clean as Notion** — non-engineers write and review docs without friction, no markdown syntax required
2. **Agents get a reliable, structured API** — any agent (Claude, GPT, Cursor, LangChain) can query context, create docs, update docs, and flag for review via a simple REST API with predictable responses
3. **The human-agent review loop is a first-class feature** — agent-authored content enters a Draft state and requires human approval before becoming part of the trusted knowledge base
4. **Zero-ops for teams** — Aqli is a hosted product (Cloudflare Workers + Supabase); a team onboards in minutes with nothing to deploy or operate
5. **Portable storage** — all docs stored as Markdown with structured frontmatter, exportable, readable without Aqli

---

## Non-Goals (V1)

| Non-goal | Reason |
|---|---|
| Real-time multiplayer editing (Yjs/CRDTs) | Adds significant complexity; autosave + last-write-wins is sufficient for V1 |
| Public doc publishing | Internal teams only; public docs are a different product |
| Mobile app | Web-responsive is sufficient for V1 |
| Plugin/extension marketplace | Over-engineering for an early product |
| Whiteboard or database views | This is not Notion; scope must stay tight |
| Complex RBAC permissions | Role: Admin / Editor / Viewer is enough for V1 |
| Self-hosted / on-prem distribution | **Descoped (July 2026):** Aqli ships as a hosted product only. Markdown-native storage and per-doc export keep data portable; there is no Docker/self-host target to build or support. |

---

## Target Users

### Primary: Engineering leads and PMs at AI-native teams
Teams of 3–30 people actively using AI coding agents (Cursor, Claude Code, Copilot) who feel the pain of agents having no persistent context. They want this working out of the box — not another internal tool to build and operate.

### Secondary: Compliance and operations team members
Non-engineers who need to write, review, and approve docs without touching a terminal. They open the browser editor, read docs, leave comments, and change status. They don't care about the Git backend.

### Tertiary: AI agents themselves
Claude Code, GPT-4o, custom LangChain agents. They interact entirely through the REST API. Their "UX" is the API schema, response structure, and consistency of the RAG query endpoint.

---

## User Stories

### Human — Engineering / PM

- As an engineer, I want to create a doc in a Space, write it in a clean editor, and link it to a Linear project, so that context is attached to execution from day one
- As a PM, I want to write a PRD using a template, assign an owner, and set a status, so that the team knows what's current and who owns it
- As a team lead, I want to search across all docs with natural language and get answers with source citations, so that I don't need to remember where things were documented
- As a team lead, I want to see all docs flagged as Stale (not reviewed in 90 days), so that I can run a quarterly doc hygiene session
- As an engineer, I want to ask "what does the AED withdrawal flow do" and get a cited answer from the docs, so that I don't need to read three documents before starting work

### Human — Compliance / Ops

- As a compliance officer, I want to receive a notification when an agent creates a doc tagged `compliance`, so that I can review and approve or reject before it's trusted
- As an ops manager, I want to open a doc in the browser, read the body, and change its status from `Review` to `Approved`, without ever touching a terminal
- As a compliance officer, I want to see a full version history of any doc, so that I can audit what changed and when

### AI Agent

- As an agent, I want to call `GET /api/context?query=...` and receive ranked, cited doc chunks before starting a task, so that I act on real team context not hallucinated assumptions
- As an agent, I want to call `POST /api/docs` to create a fix note after completing a task, so that my output is documented and reviewable
- As an agent, I want to call `POST /api/docs/:id/review` to flag a doc for human review, so that the human approval loop is triggered before the doc is trusted
- As an agent, I want to call `GET /api/docs/:id` to read a full doc, so that I can reference prior decisions before making new ones

---

## Requirements

### P0 — Must Have (MVP cannot ship without these)

**Authentication**
- [ ] Email + password login
- [ ] Invite-based team membership
- [ ] API key auth for agents (workspace-scoped)

**Spaces**
- [ ] Create and name Spaces (Product, Engineering, Compliance, Ops, etc.)
- [ ] List docs within a Space
- [ ] Sidebar navigation between Spaces

**Docs — Editor**
- [ ] Tiptap-based rich text editor (headings, lists, code blocks, tables)
- [ ] Autosave on edit (debounced, 2s)
- [ ] Doc metadata: title, type, owner, status, tags, linked project URL
- [ ] Doc types: PRD, ADR, Runbook, Fix Note, Compliance, Decision, General
- [ ] Status workflow: Draft → Review → Approved → Stale
- [ ] Templates per doc type (pre-populated structure)

**Storage**
- [ ] Docs stored as Markdown + YAML frontmatter in Supabase Storage or GitHub repo
- [ ] Version history (autosaved snapshots on status change)
- [ ] Markdown export per doc

**Search**
- [ ] Full-text search across all docs (Postgres full-text)
- [ ] Filter by Space, type, status, owner, tag

**AI — RAG Layer**
- [ ] Chunk docs on save by heading structure
- [ ] Embed chunks using OpenAI text-embedding-3-small (BYO key)
- [ ] Store embeddings in pgvector
- [ ] Natural language query endpoint: `GET /api/context?query=...`
- [ ] Response includes ranked chunks with doc title, section, and source link
- [ ] Re-embed on doc update

**Agent API**
- [ ] `GET /api/context?query=` — semantic search, returns ranked chunks with citations
- [ ] `GET /api/docs` — list docs (filterable by space, type, status)
- [ ] `GET /api/docs/:id` — read full doc (returns Markdown + frontmatter)
- [ ] `POST /api/docs` — create doc (agent-authored, auto-sets status: Draft, author_type: agent)
- [ ] `PUT /api/docs/:id` — update doc body or metadata
- [ ] `POST /api/docs/:id/review` — flag doc for human review

**Review Loop**
- [ ] Docs created by agents land in `Draft` with `author_type: agent` flag
- [ ] Reviewers see a queue of agent-authored docs pending review
- [ ] Reviewer can Approve, Request Changes, or Reject
- [ ] Status changes are versioned and timestamped

**Deployment** *(replaced the former Self-host P0 — there is no self-hosted version)*
- [ ] Hosted on Cloudflare Workers via OpenNext (`wrangler deploy`), Supabase for Postgres/pgvector/Auth
- [ ] `.env.example` with all required environment variables documented
- [ ] Production secrets managed via `wrangler secret` (OpenAI, Composio, Supabase service key)
- [ ] Database schema fully reproducible from checked-in migrations (dev/staging environments)

### P1 — Nice to Have (ship soon after MVP)

- [ ] Integration: Linear URL detection + issue/project preview in doc sidebar
- [ ] Stale doc detection (flag docs not reviewed in N days, configurable per workspace)
- [ ] Email/Slack notifications on review requests and approvals
- [ ] "Ask a question" chat interface (multi-doc RAG conversation, not just search)
- [ ] Agent write log — visible audit trail of which agent created/modified which doc
- [ ] Backlinks — show which other docs link to this doc
- [ ] Bulk doc import from Markdown files or Notion export
- [ ] GitHub integration: agent can commit Markdown to a repo alongside the Aqli record

### P2 — Future

- [ ] Jira integration (for teams not on Linear)
- [ ] Real-time multiplayer editing (Yjs)
- [ ] Custom doc type schemas per workspace
- [ ] Hosted cloud tier (managed infrastructure, SSO, audit logs)
- [ ] MCP server for Aqli (expose Aqli context to any MCP-compatible agent natively)
- [ ] CLI tool for agents (`aqli query "..."`, `aqli create --type fix-note`)

---

## Success Metrics

### Leading (days–weeks post-launch)
- Time to first doc created after workspace setup: < 5 minutes
- Agent API round-trip latency for `/api/context`: < 800ms p95
- % of docs with all required frontmatter fields populated: > 80%
- Agent-authored docs reviewed within 48 hours: > 70%

### Lagging (weeks–months post-launch)
- % of active agents on the team calling `/api/context` before starting tasks: target 100%
- Doc staleness rate (docs > 90 days without review): < 20%
- Team retention (weekly active workspace users after 30 days): > 60%
- GitHub stars within 90 days of open source release: > 500 (signals PMF signal)

---

## Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| Should agent-authored docs go to Draft or a separate `Agent Draft` status? | Product | No — start with single Draft status, revisit |
| What's the right chunking strategy for very long PRDs? (by heading vs fixed token size) | Engineering | No — default to heading-based, add config later |
| Should Linear integration be an official P0 for Tabadulat's use case? | Ali | No — useful but doesn't block OSS release |
| Do we need a webhook on doc status change for agent workflows? | Engineering | No — polling is fine for V1 |
| What's the right default embedding model? (cost vs quality tradeoff) | Engineering | No — start with text-embedding-3-small |

---

## Phased Roadmap

### Phase 1 — Personal Infrastructure (Weeks 1–4)
Build for Ali's own use across Tabadulat, Wikime, SIRO. Single workspace per deployment. Focus on getting the human editor and agent API working well.

### Phase 2 — Multi-team Hardening (Weeks 5–8)
Multi-workspace support. Linear integration. Notifications. Stale doc detection. Review workflow polish. This is when Tabadulat runs it in production.

### Phase 3 — Open Source Release (Weeks 9–12)
Clean README. Demo video. Setup docs. Public GitHub repo under SIRO org. ProductHunt launch. Gather community feedback.

### Phase 4 — Paid Tier (Post-launch, if demand)
Aqli is hosted-only from day one, so this phase is about monetising the managed product: SSO. Advanced audit logs. Stripe billing.

---

# 2. Technical Architecture

## Architecture Philosophy

- **Boring tech, well-chosen** — no experimental frameworks, no infrastructure that requires a PhD to run
- **Portable storage** — Markdown + frontmatter means your docs never depend on Aqli being alive
- **BYO everything** — AI keys, database, storage backend. Aqli is the orchestration layer
- **Agent-first API design** — the API is not an afterthought; it's a primary interface alongside the browser editor

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        AQLI                                  │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐ │
│  │  Browser UI  │    │  Agent API   │    │  Background   │ │
│  │  (Next.js)   │    │  (REST)      │    │  Workers      │ │
│  │              │    │              │    │               │ │
│  │  Tiptap      │    │  /context    │    │  Embedder     │ │
│  │  Editor      │    │  /docs       │    │  Stale Check  │ │
│  │  Spaces UI   │    │  /review     │    │  Notifier     │ │
│  └──────┬───────┘    └──────┬───────┘    └───────┬───────┘ │
│         │                   │                    │         │
│  ┌──────▼───────────────────▼────────────────────▼───────┐ │
│  │                    Core API Layer                      │ │
│  │              Next.js API Routes / Hono                 │ │
│  └──────┬───────────────────────────────────────────────┘ │
│         │                                                   │
│  ┌──────▼───────────────────────────────────────────────┐  │
│  │                   Data Layer                          │  │
│  │                                                       │  │
│  │  Postgres (Supabase)    pgvector    Supabase Auth     │  │
│  │  - docs                 - chunks   - users            │  │
│  │  - doc_versions         - embeds   - api_keys         │  │
│  │  - spaces                                             │  │
│  │  - workspaces                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                   │
│  ┌──────▼───────────────────────────────────────────────┐  │
│  │                 Storage Layer                         │  │
│  │                                                       │  │
│  │  Supabase Storage (or GitHub API)                     │  │
│  │  - Markdown files + YAML frontmatter                  │  │
│  │  - Version snapshots                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────────────┐
│              External Integrations                         │
│                                                           │
│  OpenAI API (embeddings + completions)                    │
│  Linear API (issue/project preview)                       │
│  Slack API (notifications — P1)                           │
└───────────────────────────────────────────────────────────┘
```

---

## Stack Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Ali's existing stack across projects; RSC for fast initial loads |
| Editor | Tiptap v2 | Best-in-class rich text, clean Markdown export, extensible, proven |
| Backend | Next.js API Routes (+ Hono for agent API) | Keep it simple; Hono adds type-safe routing for the agent-facing REST layer |
| Database | Supabase (Postgres + pgvector + Auth) | Already used across SIRO projects; pgvector native for embeddings |
| Storage | Supabase Storage (primary) / GitHub API (optional) | Supabase for simplicity; GitHub backend for teams who want Git-native portability |
| Embeddings | OpenAI text-embedding-3-small | Best cost/quality tradeoff; BYO key |
| AI completions | OpenAI GPT-4o-mini | For AI summaries and Q&A; BYO key |
| Hosting | Cloudflare Workers (OpenNext) + Supabase | Zero-ops managed deployment; no self-hosted distribution |
| Styling | Tailwind CSS | Fast iteration, consistent with existing SIRO tooling |

---

## Database Schema

```sql
-- Workspaces (one per deployment in V1, multi-workspace in V2)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spaces (Product, Engineering, Compliance, etc.)
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);

-- Docs
CREATE TABLE docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  -- type: prd | adr | runbook | fix_note | compliance | decision | general
  status TEXT NOT NULL DEFAULT 'draft',
  -- status: draft | review | approved | stale | archived
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL DEFAULT 'human',
  -- author_type: human | agent
  agent_id TEXT,
  -- which agent created/last modified this doc
  body_json JSONB,
  -- Tiptap JSON (source of truth for editor)
  body_md TEXT,
  -- Markdown export (regenerated on save)
  frontmatter JSONB DEFAULT '{}',
  -- {tags, linked_project_url, linear_project_id, custom_fields}
  storage_path TEXT,
  -- path in Supabase Storage or GitHub
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doc versions (snapshot on status change)
CREATE TABLE doc_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES docs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  frontmatter JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_by_agent TEXT,
  change_type TEXT,
  -- status_change | edit | agent_update | review
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doc chunks (for RAG)
CREATE TABLE doc_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES docs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  heading TEXT,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  -- text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector index
CREATE INDEX doc_chunks_embedding_idx
  ON doc_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- API keys (for agents)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- "Claude Code agent", "Cursor agent", etc.
  key_hash TEXT UNIQUE NOT NULL,
  -- bcrypt hash of the actual key
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Members
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor',
  -- role: admin | editor | viewer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

---

## Agent API Specification

All agent endpoints require `Authorization: Bearer <api_key>` header.

### Context Query

```
GET /api/agent/context?query={query}&limit={n}&space={space_id}&type={doc_type}&status=approved

Response 200:
{
  "query": "AED withdrawal flow",
  "results": [
    {
      "doc_id": "uuid",
      "doc_title": "AED Withdrawal Flow",
      "doc_type": "prd",
      "doc_status": "approved",
      "space": "Product",
      "heading": "Error Handling",
      "content": "When a withdrawal fails validation...",
      "score": 0.94,
      "source_url": "https://your-aqli.app/docs/uuid#error-handling",
      "last_reviewed_at": "2025-06-01T00:00:00Z"
    }
  ],
  "total": 5
}
```

**Design notes:**
- Default: only returns `status: approved` docs. Agents should not act on unreviewed content unless explicitly queried
- `?status=all` returns drafts too (for agents reviewing their own prior output)
- Results are ranked by cosine similarity, secondary sort by `last_reviewed_at` DESC

### List Docs

```
GET /api/agent/docs?space={slug}&type={type}&status={status}&limit=20&offset=0

Response 200:
{
  "docs": [
    {
      "id": "uuid",
      "title": "AED Withdrawal Flow",
      "type": "prd",
      "status": "approved",
      "owner": "ali",
      "space": "product",
      "tags": ["payments", "withdrawal"],
      "updated_at": "2025-06-01T00:00:00Z",
      "url": "https://your-aqli.app/docs/uuid"
    }
  ],
  "total": 12,
  "has_more": false
}
```

### Read Doc

```
GET /api/agent/docs/:id?format=markdown|json

Response 200 (markdown):
{
  "id": "uuid",
  "title": "AED Withdrawal Flow",
  "type": "prd",
  "status": "approved",
  "frontmatter": {
    "owner": "ali",
    "tags": ["payments", "withdrawal"],
    "linear_project_url": "https://linear.app/tabadulat/project/TAB-234",
    "last_reviewed_at": "2025-06-01"
  },
  "body_md": "## Overview\n\nThe AED withdrawal flow...",
  "version": 4
}
```

### Create Doc (Agent)

```
POST /api/agent/docs

Request body:
{
  "title": "Fix: Withdrawal timeout handling",
  "type": "fix_note",
  "space": "engineering",
  "tags": ["payments", "timeout", "fix"],
  "body_md": "## What was fixed\n\nAdded 30s timeout...",
  "linked_doc_ids": ["uuid-of-prd"],
  "agent_id": "claude-code-cursor"
}

Response 201:
{
  "id": "uuid",
  "title": "Fix: Withdrawal timeout handling",
  "status": "draft",
  "author_type": "agent",
  "review_url": "https://your-aqli.app/review/uuid",
  "message": "Doc created. Flagged for human review."
}
```

### Request Review

```
POST /api/agent/docs/:id/review

Request body:
{
  "note": "This fix note documents the timeout change in PR #341. Please review before merging to main context."
}

Response 200:
{
  "status": "review_requested",
  "reviewers_notified": ["ali@tabadulat.com"],
  "message": "Human review requested. Doc will not enter trusted context until approved."
}
```

### Update Doc

```
PUT /api/agent/docs/:id

Request body (partial update, all fields optional):
{
  "body_md": "## Updated content...",
  "frontmatter": {
    "tags": ["payments", "timeout", "fix", "v2"]
  }
}

Response 200:
{
  "id": "uuid",
  "version": 5,
  "updated_at": "2025-06-05T12:00:00Z"
}
```

---

## RAG Pipeline

```
On doc save:
  1. Extract Markdown from Tiptap JSON
  2. Split by heading (h2/h3 boundaries)
  3. For each chunk:
     a. Prepend: "[Doc: {title}] [{Space}] [{Type}] [{Status}]\n{heading}\n"
     b. Truncate to 512 tokens
     c. Embed with text-embedding-3-small
     d. Upsert into doc_chunks (delete old chunks for this doc first)
  4. Store embedding in pgvector
  5. Update doc.updated_at

On context query:
  1. Embed the query string
  2. Run cosine similarity search in pgvector:
     SELECT chunks.*, docs.title, docs.status, docs.type
     FROM doc_chunks chunks
     JOIN docs ON chunks.doc_id = docs.id
     WHERE docs.workspace_id = $workspace_id
       AND docs.status = 'approved'  -- default, overrideable
     ORDER BY chunks.embedding <=> $query_embedding
     LIMIT $limit;
  3. Return ranked results with source metadata
```

---

## Frontmatter Schema

Every doc's Markdown file includes a YAML frontmatter block. This is what makes docs machine-readable without the Aqli app.

```yaml
---
id: uuid
title: AED Withdrawal Flow
type: prd
status: approved
owner: ali
space: product
tags:
  - payments
  - withdrawal
  - compliance
linear_project_url: https://linear.app/tabadulat/project/TAB-234
linear_issue_ids:
  - TAB-234
  - TAB-290
author_type: human
agent_id: null
version: 4
created_at: 2025-01-15T10:00:00Z
updated_at: 2025-06-01T12:00:00Z
last_reviewed_at: 2025-06-01
reviewed_by: ali
---

## Overview

The AED withdrawal flow allows users to...
```

---

## Deployment Architecture (Hosted)

> The original v1.0 plan shipped a Docker Compose self-host target. That was
> **descoped in July 2026** — Aqli is a hosted product only. The deployment
> story as built:

- **App**: Next.js 16 compiled with OpenNext and deployed to **Cloudflare
  Workers** (`wrangler.jsonc`; `pnpm deploy` → `opennextjs-cloudflare build && deploy`).
- **Database / Auth / vectors**: hosted **Supabase** project (Postgres +
  pgvector + Auth). Schema managed via `supabase/migrations/`.
- **Secrets**: `wrangler secret` for `OPENAI_API_KEY`, `SUPABASE_SERVICE_KEY`,
  and Composio keys; public config (`NEXT_PUBLIC_*`) in build-time env.
- **Webhooks**: Composio delivers GitHub/Linear events to
  `/api/integrations/composio/webhook` on the Worker; long-running processing
  uses `ctx.waitUntil` after a fast ack.

---

# 3. Repository Structure & Build Package

## Repository Name

`aqli` — personal GitHub first: `github.com/AAALI/aqli`

> **Transfer plan**: Move to `github.com/Siro-co/aqli` at open source launch. GitHub preserves all history and auto-redirects the old URL.

## License

MIT

---

## Directory Structure

```
aqli/
├── README.md
├── LICENSE
├── wrangler.jsonc
├── open-next.config.ts
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
│
├── sql/
│   ├── init.sql                    # Full schema (run on first start)
│   ├── migrations/                 # Numbered migration files
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_api_keys.sql
│   │   └── 003_add_doc_versions.sql
│   └── seed.sql                    # Demo workspace + sample docs
│
├── app/                            # Next.js 15 App Router
│   ├── layout.tsx
│   ├── page.tsx                    # Redirect to /login or /workspaces
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── invite/[token]/page.tsx
│   │
│   ├── (app)/
│   │   ├── layout.tsx              # App shell: sidebar + top nav
│   │   ├── workspaces/page.tsx     # Workspace switcher (V2: multi-workspace)
│   │   │
│   │   ├── [workspace]/
│   │   │   ├── layout.tsx          # Workspace layout: spaces sidebar
│   │   │   ├── page.tsx            # Home: recent docs, agent activity
│   │   │   │
│   │   │   ├── spaces/
│   │   │   │   ├── page.tsx        # All spaces overview
│   │   │   │   └── [space]/
│   │   │   │       ├── page.tsx    # Space: doc list
│   │   │   │       └── new/page.tsx
│   │   │   │
│   │   │   ├── docs/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx    # Doc viewer
│   │   │   │   │   └── edit/page.tsx # Doc editor
│   │   │   │   └── new/page.tsx
│   │   │   │
│   │   │   ├── search/page.tsx     # Full-text + AI search
│   │   │   ├── review/page.tsx     # Agent doc review queue
│   │   │   ├── stale/page.tsx      # Stale docs dashboard (P1)
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx        # Workspace settings
│   │   │       ├── members/page.tsx
│   │   │       ├── api-keys/page.tsx
│   │   │       └── integrations/page.tsx
│   │
│   └── api/                        # API routes
│       ├── auth/[...nextauth]/route.ts
│       │
│       ├── docs/
│       │   ├── route.ts            # GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts        # GET, PUT, DELETE
│       │       ├── versions/route.ts
│       │       └── review/route.ts
│       │
│       ├── spaces/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       │
│       ├── search/route.ts         # Full-text search
│       │
│       ├── ai/
│       │   ├── context/route.ts    # RAG query (human-facing)
│       │   └── summary/route.ts    # Summarize a doc
│       │
│       └── agent/                  # Agent API (API key auth)
│           ├── middleware.ts        # API key validation
│           ├── context/route.ts    # GET /api/agent/context
│           ├── docs/
│           │   ├── route.ts        # GET list, POST create
│           │   └── [id]/
│           │       ├── route.ts    # GET, PUT
│           │       └── review/route.ts
│           └── health/route.ts     # GET /api/agent/health
│
├── components/
│   ├── editor/
│   │   ├── AqliEditor.tsx          # Tiptap wrapper
│   │   ├── EditorToolbar.tsx
│   │   ├── extensions/             # Custom Tiptap extensions
│   │   │   ├── FrontmatterBlock.tsx
│   │   │   └── LinkedDocMention.tsx
│   │   └── templates/              # Doc type templates (Tiptap JSON)
│   │       ├── prd.json
│   │       ├── adr.json
│   │       ├── runbook.json
│   │       ├── fix_note.json
│   │       ├── compliance.json
│   │       └── decision.json
│   │
│   ├── docs/
│   │   ├── DocCard.tsx
│   │   ├── DocList.tsx
│   │   ├── DocMeta.tsx             # Title, type, status, owner, tags
│   │   ├── DocStatusBadge.tsx
│   │   ├── DocSidebar.tsx          # Right sidebar: links, AI summary, related
│   │   ├── AgentBadge.tsx          # "Written by agent" indicator
│   │   └── VersionHistory.tsx
│   │
│   ├── review/
│   │   ├── ReviewQueue.tsx
│   │   └── ReviewActions.tsx       # Approve / Request Changes / Reject
│   │
│   ├── search/
│   │   ├── SearchBar.tsx
│   │   └── SearchResults.tsx       # Results with doc excerpts + citations
│   │
│   ├── ai/
│   │   ├── AskQuestion.tsx         # Natural language Q&A panel
│   │   └── DocSummary.tsx          # AI summary button + result
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopNav.tsx
│   │   └── SpaceNav.tsx
│   │
│   └── ui/                         # Base components (shadcn/ui pattern)
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Dialog.tsx
│       └── ...
│
├── lib/
│   ├── db/
│   │   ├── client.ts               # Supabase client (server + browser)
│   │   ├── docs.ts                 # Doc CRUD operations
│   │   ├── spaces.ts
│   │   ├── members.ts
│   │   └── api-keys.ts
│   │
│   ├── ai/
│   │   ├── embedder.ts             # Chunk + embed a doc
│   │   ├── search.ts               # pgvector similarity search
│   │   ├── context.ts              # Build context response for agents
│   │   └── summarize.ts            # Summarize a doc with GPT-4o-mini
│   │
│   ├── storage/
│   │   ├── index.ts                # Storage interface (swap backend)
│   │   ├── supabase.ts             # Supabase Storage backend
│   │   └── github.ts               # GitHub API backend (optional)
│   │
│   ├── markdown/
│   │   ├── tiptap-to-md.ts         # Convert Tiptap JSON → Markdown
│   │   ├── md-to-tiptap.ts         # Convert Markdown → Tiptap JSON
│   │   └── frontmatter.ts          # Parse/generate YAML frontmatter
│   │
│   ├── integrations/
│   │   └── linear.ts               # Linear URL detection + issue preview
│   │
│   └── auth/
│       └── middleware.ts           # Next.js middleware: route protection
│
├── workers/
│   ├── embedder.ts                 # Background: re-embed docs on change
│   └── stale-checker.ts            # Background: flag stale docs (P1)
│
├── hooks/
│   ├── useDoc.ts
│   ├── useSearch.ts
│   └── useReviewQueue.ts
│
├── types/
│   ├── doc.ts
│   ├── space.ts
│   ├── workspace.ts
│   └── agent.ts
│
└── docs/                           # Product documentation (in Markdown)
    ├── getting-started.md
    ├── agent-api.md                # Full agent API reference
    ├── doc-types.md
    └── integrations/
        └── linear.md
```

---

## .env.example

```bash
# App
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Database (Supabase or local Postgres)
DATABASE_URL=postgresql://aqli:password@localhost:5432/aqli
# or Supabase:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# AI (required for embeddings and AI features)
OPENAI_API_KEY=sk-...

# Storage backend: 'supabase' | 'github' | 'local'
STORAGE_BACKEND=supabase

# GitHub storage (optional, only if STORAGE_BACKEND=github)
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=your-docs-repo
GITHUB_BRANCH=main

# Integrations (optional)
LINEAR_API_KEY=lin_api_...

# Notifications (P1, optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_REVIEW_CHANNEL=#doc-review
```

---

## Build Sequence for Claude Code

### Week 1 — Core Foundation
```
Tasks:
- Set up Next.js 15 project with Tailwind + TypeScript
- Supabase project (Postgres + pgvector + Auth)
- Apply core schema migration
- Supabase Auth setup (email/password)
- Spaces CRUD: create, list, sidebar nav
- Docs CRUD: create, read, update, delete
- Tiptap editor with autosave
- Doc metadata fields (type, status, owner, tags)
- Markdown export from Tiptap JSON
- Full-text search (Postgres tsvector)

Deliverable: You can create docs, write in the editor, save, and search.
```

### Week 2 — Agent API + RAG
```
Tasks:
- API key management (create, list, revoke)
- Agent API middleware (validate API key)
- GET /api/agent/context — embed query, similarity search, return results
- GET /api/agent/docs — list with filters
- GET /api/agent/docs/:id — return Markdown + frontmatter
- POST /api/agent/docs — create agent-authored doc (status: draft, author_type: agent)
- PUT /api/agent/docs/:id — update doc
- POST /api/agent/docs/:id/review — flag for review
- Background embedder (embed doc on save)
- doc_chunks table population
- pgvector index

Deliverable: Claude Code can call the API, create docs, and query context.
```

### Week 3 — Review Loop + AI UI
```
Tasks:
- Review queue page (agent-authored docs pending review)
- Approve / Request Changes / Reject actions
- Version history on status change
- AI summary button per doc (GPT-4o-mini)
- "Ask a question" panel (RAG-backed, multi-doc)
- Linear URL detection in doc body + sidebar preview
- Doc templates (PRD, ADR, Runbook, Fix Note)

Deliverable: Full human-agent review loop working end to end.
```

### Week 4 — Polish + Launch (hosted)
```
Tasks:
- Cloudflare Workers deployment (OpenNext + wrangler), production secrets
- .env.example documentation
- README: setup guide, agent API reference
- Seed script (demo workspace with sample docs)
- GitHub Actions CI (lint, type-check, test)
- Settings: workspace name, member invite, API key management

Deliverable: Aqli running in production at aqli.app; a new team can sign up,
invite members, mint an agent key, and use the full loop with nothing to deploy.
```

---

## README Excerpt (for GitHub)

```markdown
# Aqli

The open source team knowledge base for human-agent teams.

A single place where humans write docs, agents read context,
agents write output, and humans review and approve.

## Why Aqli

Confluence and Notion were built for human-only teams.
Your team now includes AI agents. They need to read context
before acting, and write back what they did. Aqli is the
missing shared context layer.

## Features

- Clean browser editor (Tiptap) — non-engineers write docs without friction
- Structured doc types: PRD, ADR, Runbook, Fix Note, Compliance, Decision
- Agent REST API: query context, create docs, request review
- Built-in RAG: every doc is embedded and searchable by agents
- Human-agent review loop: agent docs are flagged for human approval
- Linear integration: link docs to projects and issues
- Hosted: nothing to deploy or operate — sign up and go
- Portable: all docs stored as Markdown + YAML frontmatter, exportable per doc

## Quick Start

    1. Sign up at https://aqli.app (creates your workspace + default spaces)
    2. Invite your team from Settings → Members
    3. Mint an agent API key from Settings → API keys

Point your agents at the API below.

## Agent API

    # Query context before starting work
    curl https://your-aqli.app/api/agent/context \
      -H "Authorization: Bearer <api_key>" \
      -G --data-urlencode "query=AED withdrawal error handling"

    # Create a doc after completing work
    curl -X POST https://your-aqli.app/api/agent/docs \
      -H "Authorization: Bearer <api_key>" \
      -H "Content-Type: application/json" \
      -d '{"title":"Fix: timeout handling","type":"fix_note","body_md":"..."}'

Full API reference: docs/agent-api.md
```

---

*End of Aqli Product Documentation v1.0*
*Prepared for SIRO & CO — June 2026*
