# Aqli

> The shared intellect for human-agent teams.

An open source team knowledge base where humans write docs, agents read context,
agents write output, and humans review and approve.

## Status

🚧 **Week 1 — Core foundation.** Editor, spaces, docs, search, version history.
(Agent API, RAG, and AI features land in Week 2.)

## Stack

- Next.js 16 (App Router)
- Supabase (Postgres + Auth)
- Tiptap v3
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

## What's in Week 1

- Email/password auth with session persistence and route protection
- Workspaces + Spaces (sidebar nav, create spaces)
- Docs CRUD with a Tiptap editor and 2s autosave
- Doc metadata: type, status, tags, linked project URL
- Markdown generation (`body_md`) + per-doc `.md` export with frontmatter
- Postgres full-text search across titles and bodies
- Version snapshots on status change

## Roadmap

- [x] Week 1: Editor, spaces, docs, search
- [ ] Week 2: Agent API, RAG, embeddings
- [ ] Week 3: Review loop, AI features, Linear
- [ ] Week 4: Self-host, Docker Compose, open source release

## License

MIT — github.com/AAALI/aqli
