# Aqli

> The shared intellect for human-agent teams.

An open source team knowledge base where humans write docs, agents read context,
agents write output, and humans review and approve.

## Features

- ✅ Clean browser editor — write PRDs, ADRs, runbooks, fix notes
- ✅ Agent REST API — query context, create docs, request review
- ✅ Built-in RAG — every approved doc embedded and searchable by agents
- ✅ Human-agent review loop — agent docs flagged for human approval
- ✅ AI doc summary — one-click summary of any document
- ✅ Ask a question — RAG-backed Q&A across all approved docs
- ✅ Stale doc detection — flag approved docs not reviewed in 90 days
- ✅ Doc activity feed — per-doc timeline of every human and agent change
- ✅ Agent write log — full audit trail of agent activity
- ✅ Linear integration — link docs to projects and issues

## Stack

- Next.js 16 (App Router)
- Supabase (Postgres + pgvector + Auth)
- Tiptap v3
- OpenAI (text-embedding-3-small + gpt-4o-mini)
- Tailwind CSS v4
- pnpm

## Development

```bash
pnpm install
cp .env.example .env.local
# Fill in your Supabase URL + anon key (already set for the Aqli project)
pnpm dev
```

Open http://localhost:3000 and sign up — this creates your workspace with default
spaces (Product, Engineering, Compliance).

> **Dev note:** disable "Confirm email" in your Supabase project (Auth → Providers)
> so signup returns an immediate session during local development.

## Agent API Quick Start

```bash
# Query context before starting a task
curl https://your-aqli.app/api/agent/context \
  -H "Authorization: Bearer aqli_your_key" \
  -G --data-urlencode "query=AED withdrawal flow"

# Create a doc after completing work
curl -X POST https://your-aqli.app/api/agent/docs \
  -H "Authorization: Bearer aqli_your_key" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix: timeout","type":"fix_note","body_md":"..."}'
```

## Roadmap

- [x] Week 1: Editor, spaces, docs, search
- [x] Week 2: Agent API, RAG, embeddings
- [x] Week 3: Review loop, AI features, stale detection
- [ ] Week 4: Self-host, Docker Compose, open source release

## License

MIT — github.com/AAALI/aqli

# Composio webhook probe

This tiny change exists only to trigger a real GitHub PR-merged webhook through Composio so we can verify end-to-end docs creation. Safe to delete.

Probe ping #3 — testing idempotent webhook handler + fast ack + doc creation flow.
