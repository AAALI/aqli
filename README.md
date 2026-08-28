# Aqli

> The open source company knowledge base your AI can actually trust.

Every team writes docs — policies, how-tos, briefs, PRDs, runbooks. AI
assistants read the approved ones for context and draft updates. Humans review
and approve. Nothing becomes ground truth without a person signing off.

## Features

- ✅ Clean browser editor — templates for every team: policies, how-tos, meeting notes, briefs, PRDs, ADRs, runbooks
- ✅ Diagrams — Mermaid flowcharts and sequence diagrams via `/diagram`, and agents can write them in plain markdown
- ✅ Page tree — sub-pages with drag to re-parent, breadcrumbs, and `parent_id` across the agent API and MCP
- ✅ Agent REST API — query context, create docs, request review
- ✅ MCP server — the same surface as six tools for any MCP client
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
> so signup returns an immediate session during local development. Turn it back
> on before anyone else signs up — `pnpm preflight` fails on it in production,
> because with it off anyone can sign up as any address.

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

## MCP Quick Start

Any MCP client — Claude, Cursor, an in-house assistant — connects to a
workspace with an API key. The endpoint is stateless JSON-RPC over HTTP, so it
works on Cloudflare Workers without session affinity.

```bash
claude mcp add --transport http aqli https://your-aqli.app/api/mcp \
  --header "Authorization: Bearer aqli_your_key"
```

Six tools: `search_docs`, `list_docs`, `read_doc`, `propose_doc`,
`propose_update`, `request_review`. Reads see approved documents by default;
writes are proposals subject to the space's review policy and the key's scopes,
so an assistant cannot publish unreviewed content. A key without the `propose`
scope is refused the write tools outright.

## Migrating from Confluence

[docs/moving-from-confluence.md](docs/moving-from-confluence.md) is the
playbook: the order to do things in, how to use the fidelity gate before you
trust a conversion, and an honest list of what Aqli does not do yet (per-space
permissions, one-click import, email notifications).

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full plan. Short version: Phase 1
(team-neutral onboarding, doc types, and diagrams) has shipped; Phase 2 is
table-stakes editor and organisation features (images, tables, comments,
import, sub-pages, space permissions); Phase 3 presses the AI-native advantage
(MCP server, Slack Q&A, review workflows, public sharing).

Moving a whole company onto Aqli? [ADOPTION.md](ADOPTION.md) lists what has to
be true first — import, space permissions, assistant connections, export —
with acceptance criteria for each.

## Self-hosting

Aqli is MIT-licensed and self-hostable from this repository: bring your own
Supabase project (apply the migrations in `supabase/migrations/`) and OpenAI
API key, fill in `.env.example`, and deploy the Next.js app wherever you like
(we deploy to Cloudflare Workers via OpenNext — see `wrangler.jsonc`).

Then check the instance before you invite anyone:

```bash
pnpm preflight     # or Settings → Health, for admins without a shell
```

It reports unapplied migrations, any table serving rows without row-level
security, whether markdown is canonical yet, whether approved docs are actually
embedded, and whether email confirmation is still off. Every finding names its
fix, and the command exits non-zero on a failure so it can gate a deploy.
Self-hosting is community-supported via GitHub issues. If you'd rather not run
it yourself, [Aqli Cloud](https://aqli.app) is the managed version.

## License

MIT — see [LICENSE](LICENSE)
