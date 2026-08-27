# Aqli

> The open source company knowledge base your AI can actually trust.

Every team writes docs — policies, how-tos, briefs, PRDs, runbooks. AI
assistants read the approved ones for context and draft updates. Humans review
and approve. Nothing becomes ground truth without a person signing off.

## Features

- ✅ Clean browser editor — templates for every team: policies, how-tos, meeting notes, briefs, PRDs, ADRs, runbooks
- ✅ Diagrams — Mermaid flowcharts and sequence diagrams via `/diagram`, and agents can write them in plain markdown
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
# Fill in your Supabase URL + anon key
pnpm dev
```

Open http://localhost:3000 and sign up — this creates your workspace with a
default Company space; pick spaces for your teams during onboarding.

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

See [ROADMAP.md](ROADMAP.md) for the full plan. Short version: Phase 1
(team-neutral onboarding, doc types, and diagrams) has shipped; Phase 2 is
table-stakes editor and organisation features (images, tables, comments,
import, sub-pages, space permissions); Phase 3 presses the AI-native advantage
(MCP server, Slack Q&A, review workflows, public sharing).

Moving a whole company onto Aqli? [ADOPTION.md](ADOPTION.md) lists what has to
be true first — import, page tree, space permissions, assistant connections,
export — with acceptance criteria for each.

## Self-hosting

Aqli is MIT-licensed and self-hostable from this repository: bring your own
Supabase project (apply the migrations in `supabase/migrations/`) and OpenAI
API key, fill in `.env.example`, and deploy the Next.js app wherever you like
(we deploy to Cloudflare Workers via OpenNext — see `wrangler.jsonc`).
Self-hosting is community-supported via GitHub issues. If you'd rather not run
it yourself, [Aqli Cloud](https://aqli.app) is the managed version.

## License

MIT — see [LICENSE](LICENSE)
