# Aqli — Week 2 Claude Code Build Prompt

> Paste this entire document into Claude Code at the start of the session.
> This is a self-contained build instruction. Do not skip any section.
> Week 1 must be fully complete before starting this session.

---

## Context

You are continuing to build **Aqli** — an open source team knowledge base for human-agent teams. The repository is at `github.com/AAALI/aqli`.

Week 1 delivered:
- Next.js 15 project with Supabase auth
- Spaces + docs CRUD
- Tiptap editor with autosave
- Doc metadata (type, status, owner, tags, linked URL)
- Full-text search (Postgres tsvector)
- Version snapshots on status change
- Markdown export

**Week 2 delivers the agent layer** — the core differentiator of Aqli over every other docs tool. This week makes Aqli useful to AI agents, not just humans.

---

## Week 2 Scope

Build exactly these things. Nothing else.

1. **pgvector migration** — add vector column to existing schema
2. **Embedding pipeline** — chunk and embed every doc on save
3. **API key management** — create, list, revoke keys for agents
4. **Agent API** — full REST API for agents with API key auth
5. **Linear URL detection** — detect + preview Linear links in doc sidebar
6. **Doc templates** — pre-populated content for each doc type

**Do not build this week:**
- Review queue UI (Week 3)
- AI summary button (Week 3)
- Notifications (Week 3)
- Docker Compose (Week 4)

---

## New Environment Variables

Add these to `.env.local` and `.env.example`:

```bash
# OpenAI (required for embeddings and RAG)
OPENAI_API_KEY=sk-...

# Linear integration (optional — for URL detection + preview)
LINEAR_API_KEY=lin_api_...

# App URL (used in agent API responses for source_url)
NEXT_PUBLIC_APP_URL=https://your-aqli.app
```

---

## Step 1 — pgvector Migration

Run this SQL in Supabase SQL editor. This adds the vector extension and the `doc_chunks` table to the existing Week 1 schema.

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Doc chunks for RAG
CREATE TABLE doc_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES docs(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  heading TEXT,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cosine similarity index
CREATE INDEX doc_chunks_embedding_idx
  ON doc_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for fast doc_id lookups (for deleting old chunks on re-embed)
CREATE INDEX doc_chunks_doc_id_idx ON doc_chunks(doc_id);
CREATE INDEX doc_chunks_workspace_id_idx ON doc_chunks(workspace_id);

-- API keys for agents
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  -- first 8 chars of key for display: "aqli_abc..."
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- RLS for doc_chunks
ALTER TABLE doc_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read chunks in their workspace"
  ON doc_chunks FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Service role bypasses RLS for agent API and embedder
-- (already handled by using the service key in server-side code)

-- RLS for api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage API keys"
  ON api_keys FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Members can read API keys"
  ON api_keys FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );
```

---

## Step 2 — New TypeScript Types

Add these to the existing `types/` directory.

```typescript
// types/chunk.ts
export type DocChunk = {
  id: string
  doc_id: string
  workspace_id: string
  chunk_index: number
  heading: string | null
  content: string
  token_count: number | null
  embedding: number[] | null
  created_at: string
}

export type ContextResult = {
  doc_id: string
  doc_title: string
  doc_type: string
  doc_status: string
  space: string
  heading: string | null
  content: string
  score: number
  source_url: string
  last_reviewed_at: string | null
}

// types/api-key.ts
export type ApiKey = {
  id: string
  workspace_id: string
  name: string
  key_hash: string
  key_prefix: string
  last_used_at: string | null
  created_by: string | null
  created_at: string
  revoked_at: string | null
}

export type ApiKeyWithSecret = ApiKey & {
  secret: string
  // Only returned once on creation. Never stored in plain text.
}
```

---

## Step 3 — Embedding Pipeline

This is the core of Week 2. Every doc must be chunked and embedded when saved.

### Chunking strategy

Split the doc's `body_md` at H2 and H3 heading boundaries. Each chunk includes its heading as context. Prepend metadata to each chunk so the embedding captures the doc context.

```typescript
// lib/ai/chunker.ts

export type Chunk = {
  heading: string | null
  content: string
  index: number
}

/**
 * Split Markdown into chunks at h2/h3 heading boundaries.
 * Each chunk gets the heading as context.
 * Max ~400 words per chunk (well within 512 token limit for embedding).
 */
export function chunkMarkdown(
  markdown: string,
  docTitle: string,
  docType: string,
  docSpace: string,
  docStatus: string
): Chunk[] {
  if (!markdown.trim()) return []

  // Split at h2/h3 headings
  const lines = markdown.split('\n')
  const sections: { heading: string | null; lines: string[] }[] = []
  let current: { heading: string | null; lines: string[] } = {
    heading: null,
    lines: [],
  }

  for (const line of lines) {
    if (/^#{2,3}\s/.test(line)) {
      if (current.lines.join('\n').trim()) {
        sections.push(current)
      }
      current = {
        heading: line.replace(/^#{2,3}\s/, '').trim(),
        lines: [],
      }
    } else {
      current.lines.push(line)
    }
  }

  if (current.lines.join('\n').trim()) {
    sections.push(current)
  }

  // Build chunks with metadata prefix
  return sections.map((section, index) => {
    const metaPrefix = [
      `[Doc: ${docTitle}]`,
      `[Space: ${docSpace}]`,
      `[Type: ${docType}]`,
      `[Status: ${docStatus}]`,
      section.heading ? `[Section: ${section.heading}]` : null,
    ]
      .filter(Boolean)
      .join(' ')

    const content = [metaPrefix, '', section.heading ?? '', section.lines.join('\n')]
      .filter(s => s !== null)
      .join('\n')
      .trim()

    return {
      heading: section.heading,
      content,
      index,
    }
  })
}
```

### Embedder

```typescript
// lib/ai/embedder.ts
import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import { chunkMarkdown } from './chunker'
import type { Doc } from '@/types/doc'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Embed a doc: chunk it, embed each chunk, upsert into doc_chunks.
 * Called after every doc save where body_md changes.
 */
export async function embedDoc(doc: Doc, spaceName: string): Promise<void> {
  const supabase = createServiceClient()

  if (!doc.body_md || doc.body_md.trim().length < 20) {
    // Too short to be worth embedding — delete any existing chunks
    await supabase.from('doc_chunks').delete().eq('doc_id', doc.id)
    return
  }

  const chunks = chunkMarkdown(
    doc.body_md,
    doc.title,
    doc.type,
    spaceName,
    doc.status
  )

  if (chunks.length === 0) return

  // Embed all chunks in a single API call (batch)
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks.map(c => c.content),
  })

  const vectors = embeddingResponse.data.map((e, i) => ({
    doc_id: doc.id,
    workspace_id: doc.workspace_id,
    chunk_index: chunks[i].index,
    heading: chunks[i].heading,
    content: chunks[i].content,
    token_count: chunks[i].content.split(/\s+/).length,
    embedding: e.embedding,
  }))

  // Delete old chunks for this doc then insert new ones
  await supabase.from('doc_chunks').delete().eq('doc_id', doc.id)
  await supabase.from('doc_chunks').insert(vectors)
}
```

### Context search

```typescript
// lib/ai/context.ts
import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import type { ContextResult } from '@/types/chunk'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function queryContext(
  workspaceId: string,
  query: string,
  options?: {
    limit?: number
    spaceSlug?: string
    docType?: string
    status?: string
    // defaults to 'approved' — agents should not act on unreviewed content
  }
): Promise<ContextResult[]> {
  const limit = options?.limit ?? 5
  const status = options?.status ?? 'approved'

  // Embed the query
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })
  const queryEmbedding = embeddingResponse.data[0].embedding

  // Build the pgvector similarity query via Supabase RPC
  // We use a raw SQL RPC because Supabase JS doesn't natively support <=> operator
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('search_doc_chunks', {
    query_embedding: queryEmbedding,
    workspace_id_param: workspaceId,
    status_param: status,
    match_count: limit,
    space_slug_param: options?.spaceSlug ?? null,
    doc_type_param: options?.docType ?? null,
  })

  if (error) throw error

  return (data ?? []).map((row: any): ContextResult => ({
    doc_id: row.doc_id,
    doc_title: row.doc_title,
    doc_type: row.doc_type,
    doc_status: row.doc_status,
    space: row.space_name,
    heading: row.heading,
    content: row.content,
    score: row.similarity,
    source_url: `${process.env.NEXT_PUBLIC_APP_URL}/docs/${row.doc_id}${
      row.heading ? `#${row.heading.toLowerCase().replace(/\s+/g, '-')}` : ''
    }`,
    last_reviewed_at: row.last_reviewed_at,
  }))
}
```

### Supabase RPC function

Run this SQL in Supabase to create the search function:

```sql
CREATE OR REPLACE FUNCTION search_doc_chunks(
  query_embedding vector(1536),
  workspace_id_param UUID,
  status_param TEXT DEFAULT 'approved',
  match_count INTEGER DEFAULT 5,
  space_slug_param TEXT DEFAULT NULL,
  doc_type_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  doc_id UUID,
  doc_title TEXT,
  doc_type TEXT,
  doc_status TEXT,
  space_name TEXT,
  heading TEXT,
  content TEXT,
  similarity FLOAT,
  last_reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS doc_id,
    d.title AS doc_title,
    d.type AS doc_type,
    d.status AS doc_status,
    s.name AS space_name,
    c.heading,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    d.last_reviewed_at
  FROM doc_chunks c
  JOIN docs d ON c.doc_id = d.id
  LEFT JOIN spaces s ON d.space_id = s.id
  WHERE
    c.workspace_id = workspace_id_param
    AND d.status = status_param
    AND (space_slug_param IS NULL OR s.slug = space_slug_param)
    AND (doc_type_param IS NULL OR d.type = doc_type_param)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Hook embedder into doc save

Update the existing `PUT /api/docs/[id]/route.ts` to trigger embedding when `body_md` changes:

```typescript
// In app/api/docs/[id]/route.ts — update the PUT handler

import { embedDoc } from '@/lib/ai/embedder'
import { getSpace } from '@/lib/supabase/spaces'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates = await req.json()
  const doc = await updateDoc(params.id, updates)

  // Re-embed if content changed
  if (updates.body_md && doc.space_id) {
    const space = await getSpace(doc.space_id)
    // Fire and forget — don't block the response
    embedDoc(doc, space?.name ?? 'Unknown').catch(err =>
      console.error('Embed failed for doc', doc.id, err)
    )
  }

  return NextResponse.json({ doc })
}
```

---

## Step 4 — API Key Management

### Key generation utility

```typescript
// lib/api-keys.ts
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiKey, ApiKeyWithSecret } from '@/types/api-key'

/**
 * Generate a new API key.
 * Format: aqli_<32 random hex chars>
 * We store a SHA-256 hash. The plain key is returned only once.
 */
export async function createApiKey(
  workspaceId: string,
  name: string,
  createdBy: string
): Promise<ApiKeyWithSecret> {
  const rawKey = `aqli_${crypto.randomBytes(24).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 12) + '...'

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      workspace_id: workspaceId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) throw error

  return { ...data, secret: rawKey } as ApiKeyWithSecret
}

export async function validateApiKey(
  rawKey: string
): Promise<{ valid: boolean; workspaceId: string | null; keyId: string | null }> {
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('api_keys')
    .select('id, workspace_id, revoked_at')
    .eq('key_hash', keyHash)
    .single()

  if (!data || data.revoked_at) {
    return { valid: false, workspaceId: null, keyId: null }
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return { valid: true, workspaceId: data.workspace_id, keyId: data.id }
}

export async function listApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, workspace_id, name, key_prefix, last_used_at, created_by, created_at, revoked_at')
    .eq('workspace_id', workspaceId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ApiKey[]
}

export async function revokeApiKey(id: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
```

### API key routes

```typescript
// app/api/keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createApiKey, listApiKeys } from '@/lib/api-keys'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const keys = await listApiKeys(workspaceId)
  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, name } = await req.json()
  if (!workspace_id || !name) {
    return NextResponse.json({ error: 'workspace_id and name required' }, { status: 400 })
  }

  // createApiKey returns the secret only once — make sure client stores it
  const key = await createApiKey(workspace_id, name, user.id)
  return NextResponse.json({
    key,
    warning: 'Store this key securely. It will not be shown again.',
  }, { status: 201 })
}

// app/api/keys/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revokeApiKey } from '@/lib/api-keys'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await revokeApiKey(params.id)
  return NextResponse.json({ success: true })
}
```

---

## Step 5 — Agent API

This is the entire `/api/agent/*` namespace. All routes use API key auth, not session auth.

### Agent auth middleware

```typescript
// app/api/agent/middleware.ts
import { NextRequest } from 'next/server'
import { validateApiKey } from '@/lib/api-keys'

export type AgentContext = {
  workspaceId: string
  keyId: string
}

export async function authenticateAgent(
  req: NextRequest
): Promise<AgentContext | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey.startsWith('aqli_')) return null

  const { valid, workspaceId, keyId } = await validateApiKey(rawKey)
  if (!valid || !workspaceId || !keyId) return null

  return { workspaceId, keyId }
}
```

### Agent health check

```typescript
// app/api/agent/health/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent } from '../middleware'

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }
  return NextResponse.json({
    status: 'ok',
    workspace_id: agent.workspaceId,
    version: '0.2.0',
  })
}
```

### Agent context query

```typescript
// app/api/agent/context/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent } from '../middleware'
import { queryContext } from '@/lib/ai/context'

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req)
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query')
  if (!query) {
    return NextResponse.json({ error: 'query parameter required' }, { status: 400 })
  }

  const results = await queryContext(agent.workspaceId, query, {
    limit: Number(searchParams.get('limit') ?? 5),
    spaceSlug: searchParams.get('space') ?? undefined,
    docType: searchParams.get('type') ?? undefined,
    status: searchParams.get('status') ?? 'approved',
  })

  return NextResponse.json({
    query,
    results,
    total: results.length,
  })
}
```

### Agent docs list + create

```typescript
// app/api/agent/docs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent } from '../middleware'
import { getDocs, createDoc } from '@/lib/supabase/docs'
import { getSpaceBySlug } from '@/lib/supabase/spaces'
import { embedDoc } from '@/lib/ai/embedder'
import type { DocType } from '@/types/doc'

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? 20)
  const offset = Number(searchParams.get('offset') ?? 0)

  const docs = await getDocs(agent.workspaceId, {
    type: searchParams.get('type') as DocType ?? undefined,
    status: searchParams.get('status') as any ?? undefined,
    limit,
    offset,
  })

  return NextResponse.json({
    docs: docs.map(d => ({
      id: d.id,
      title: d.title,
      type: d.type,
      status: d.status,
      space: (d as any).space?.slug ?? null,
      tags: d.frontmatter?.tags ?? [],
      author_type: d.author_type,
      updated_at: d.updated_at,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/docs/${d.id}`,
    })),
    total: docs.length,
    has_more: docs.length === limit,
  })
}

export async function POST(req: NextRequest) {
  const agent = await authenticateAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, type, space, tags, body_md, linked_doc_ids, agent_id } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  // Resolve space slug to ID
  let spaceId: string | undefined
  let spaceName = 'Unknown'
  if (space) {
    const spaceRecord = await getSpaceBySlug(agent.workspaceId, space)
    if (spaceRecord) {
      spaceId = spaceRecord.id
      spaceName = spaceRecord.name
    }
  }

  const doc = await createDoc({
    workspace_id: agent.workspaceId,
    space_id: spaceId,
    title,
    type: type ?? 'general',
    body_md,
    author_type: 'agent',
    agent_id: agent_id ?? 'unknown',
    frontmatter: {
      tags: tags ?? [],
      linked_doc_ids: linked_doc_ids ?? [],
    },
  })

  // Embed immediately
  if (body_md) {
    await embedDoc(doc, spaceName)
  }

  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    status: doc.status,
    author_type: doc.author_type,
    review_url: `${process.env.NEXT_PUBLIC_APP_URL}/review/${doc.id}`,
    message: 'Doc created. Flagged for human review.',
  }, { status: 201 })
}
```

### Agent doc get + update

```typescript
// app/api/agent/docs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent } from '../../middleware'
import { getDoc, updateDoc } from '@/lib/supabase/docs'
import { getSpace } from '@/lib/supabase/spaces'
import { embedDoc } from '@/lib/ai/embedder'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await authenticateAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await getDoc(params.id)
  if (doc.workspace_id !== agent.workspaceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const format = new URL(req.url).searchParams.get('format') ?? 'markdown'

  if (format === 'json') {
    return NextResponse.json({ doc })
  }

  // Markdown format (default)
  const frontmatter = [
    '---',
    `id: ${doc.id}`,
    `title: ${doc.title}`,
    `type: ${doc.type}`,
    `status: ${doc.status}`,
    `author_type: ${doc.author_type}`,
    doc.agent_id ? `agent_id: ${doc.agent_id}` : null,
    `tags: [${(doc.frontmatter?.tags ?? []).join(', ')}]`,
    doc.frontmatter?.linked_project_url
      ? `linked_project_url: ${doc.frontmatter.linked_project_url}`
      : null,
    `updated_at: ${doc.updated_at}`,
    doc.last_reviewed_at ? `last_reviewed_at: ${doc.last_reviewed_at}` : null,
    '---',
  ]
    .filter(Boolean)
    .join('\n')

  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    status: doc.status,
    frontmatter: doc.frontmatter,
    body_md: `${frontmatter}\n\n${doc.body_md ?? ''}`,
    version: null,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await authenticateAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await getDoc(params.id)
  if (doc.workspace_id !== agent.workspaceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates = await req.json()
  const updated = await updateDoc(params.id, {
    body_md: updates.body_md,
    frontmatter: updates.frontmatter
      ? { ...doc.frontmatter, ...updates.frontmatter }
      : undefined,
  })

  // Re-embed if content changed
  if (updates.body_md && updated.space_id) {
    const space = await getSpace(updated.space_id)
    embedDoc(updated, space?.name ?? 'Unknown').catch(console.error)
  }

  return NextResponse.json({
    id: updated.id,
    version: null,
    updated_at: updated.updated_at,
  })
}
```

### Agent review request

```typescript
// app/api/agent/docs/[id]/review/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent } from '../../../middleware'
import { getDoc, updateDoc } from '@/lib/supabase/docs'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await authenticateAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await getDoc(params.id)
  if (doc.workspace_id !== agent.workspaceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Update status to 'review'
  await updateDoc(params.id, { status: 'review' })

  // TODO Week 3: send email/Slack notification to workspace admins

  return NextResponse.json({
    status: 'review_requested',
    message: 'Human review requested. Doc will not enter trusted context until approved.',
    review_url: `${process.env.NEXT_PUBLIC_APP_URL}/review/${params.id}`,
  })
}
```

---

## Step 6 — Linear URL Detection

Detect Linear URLs in the doc's linked_project_url field and show a preview in the right sidebar.

```typescript
// lib/integrations/linear.ts

export type LinearPreview = {
  id: string
  title: string
  status: string
  url: string
  type: 'issue' | 'project'
}

/**
 * Detect if a URL is a Linear URL and extract the ID.
 * Supports:
 *   https://linear.app/{team}/issue/{id}
 *   https://linear.app/{team}/project/{id}
 */
export function parseLinearUrl(url: string): {
  type: 'issue' | 'project'
  id: string
} | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('linear.app')) return null

    const parts = parsed.pathname.split('/').filter(Boolean)
    // parts: [team, 'issue' | 'project', id]
    if (parts.length < 3) return null

    const type = parts[1] === 'issue' ? 'issue' : 'project'
    return { type, id: parts[2] }
  } catch {
    return null
  }
}

/**
 * Fetch Linear issue or project preview.
 * Requires LINEAR_API_KEY in environment.
 * Returns null gracefully if API key not set or request fails.
 */
export async function fetchLinearPreview(
  url: string
): Promise<LinearPreview | null> {
  const parsed = parseLinearUrl(url)
  if (!parsed) return null

  const apiKey = process.env.LINEAR_API_KEY
  if (!apiKey) return null

  try {
    if (parsed.type === 'issue') {
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify({
          query: `{
            issue(id: "${parsed.id}") {
              id
              title
              url
              state { name }
            }
          }`,
        }),
      })
      const data = await response.json()
      const issue = data?.data?.issue
      if (!issue) return null
      return {
        id: issue.id,
        title: issue.title,
        status: issue.state?.name ?? 'Unknown',
        url: issue.url,
        type: 'issue',
      }
    }

    if (parsed.type === 'project') {
      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify({
          query: `{
            project(id: "${parsed.id}") {
              id
              name
              url
              state
            }
          }`,
        }),
      })
      const data = await response.json()
      const project = data?.data?.project
      if (!project) return null
      return {
        id: project.id,
        title: project.name,
        status: project.state ?? 'Unknown',
        url: project.url,
        type: 'project',
      }
    }
  } catch {
    return null
  }

  return null
}
```

Add a Linear preview API route so the client can fetch without exposing the API key:

```typescript
// app/api/integrations/linear/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchLinearPreview } from '@/lib/integrations/linear'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url).searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const preview = await fetchLinearPreview(url)
  if (!preview) return NextResponse.json({ preview: null })

  return NextResponse.json({ preview })
}
```

---

## Step 7 — Doc Templates

Pre-populate the editor with structured content when a doc type is selected.

```typescript
// components/editor/templates/index.ts

export const DOC_TEMPLATES: Record<string, object> = {
  prd: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Product Requirements Document' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Overview' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Describe what this feature does and why it exists.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goals' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Goal 1' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Goal 2' }] }] },
      ]},
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Non-Goals' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What this feature explicitly does not do.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'User Flow' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Step-by-step description of the user journey.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Error States' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'How errors and edge cases are handled.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Open Questions' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Unresolved questions that need answers before shipping.' }] },
    ],
  },

  adr: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Architecture Decision Record' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Context' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What is the situation that requires a decision?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Decision' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What was decided?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Options Considered' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What alternatives were evaluated?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Consequences' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What are the trade-offs and implications?' }] },
    ],
  },

  runbook: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Runbook' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Purpose' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What does this runbook cover?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Prerequisites' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What access and tools are needed?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Steps' }] },
      { type: 'orderedList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step 1' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step 2' }] }] },
      ]},
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollback' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'How to undo this process if something goes wrong.' }] },
    ],
  },

  fix_note: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Fix Note' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What was fixed' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Describe the bug or issue that was resolved.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Root cause' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Why did this happen?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Change made' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What code or config was changed?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Testing' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'How was the fix verified?' }] },
    ],
  },

  compliance: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Compliance Document' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Regulatory Reference' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Cite the specific rule, regulation, or internal policy.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Requirement' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What must the product or process do to comply?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Implementation' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'How is this requirement implemented in the product?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Evidence' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What evidence demonstrates compliance?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Review cadence' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'How often must this be reviewed and by whom?' }] },
    ],
  },

  decision: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Decision' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Background' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What context led to this decision?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Decision' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What was decided, by whom, and when?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rationale' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Why was this the right call?' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Impact' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'What changes as a result of this decision?' }] },
    ],
  },
}
```

---

## Step 8 — Settings Page: API Key Management UI

Add this page to the settings section so workspace admins can manage agent API keys.

```
app/(app)/w/[workspace]/settings/api-keys/page.tsx
```

The page should:
- List all active API keys (name, prefix, last used, created date)
- Have a "Create API key" button that opens a dialog
- Dialog: input for key name, submit creates key, shows full key once with a "Copy" button and a warning "This key will not be shown again"
- Each key row has a "Revoke" button with a confirmation dialog
- Show the agent API base URL: `{NEXT_PUBLIC_APP_URL}/api/agent`
- Show a quick-start code snippet for Claude Code:

```
# Query context before starting a task
curl {APP_URL}/api/agent/context \
  -H "Authorization: Bearer aqli_your_key_here" \
  -G --data-urlencode "query=your question here"
```

---

## New Dependencies to Add

```bash
pnpm add openai
pnpm add @linear/sdk
```

---

## Updated .env.example

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-string-here

# OpenAI (required for embeddings and AI features)
OPENAI_API_KEY=sk-...

# Linear (optional — enables issue/project preview in doc sidebar)
LINEAR_API_KEY=lin_api_...
```

---

## Week 2 Acceptance Checklist

Before closing this session, verify every item:

**pgvector + Schema**
- [ ] `doc_chunks` table exists with `vector(1536)` column
- [ ] `api_keys` table exists
- [ ] `search_doc_chunks` RPC function exists in Supabase

**Embedding Pipeline**
- [ ] Saving a doc triggers `embedDoc` asynchronously
- [ ] `doc_chunks` rows are created with non-null embeddings after a doc save
- [ ] Old chunks are deleted and replaced when a doc is updated
- [ ] Docs shorter than 20 characters do not create chunks

**API Key Management**
- [ ] Admin can create a new API key (name required)
- [ ] Full key is shown once on creation with copy button
- [ ] Key is stored as SHA-256 hash — plain key is never in the database
- [ ] Active keys are listed with prefix, last used, created date
- [ ] Admin can revoke a key (sets `revoked_at`, key no longer validates)

**Agent API**
- [ ] `GET /api/agent/health` returns 200 with valid key, 401 without
- [ ] `GET /api/agent/context?query=...` returns ranked chunks from approved docs
- [ ] `GET /api/agent/docs` returns list of docs
- [ ] `GET /api/agent/docs/:id` returns Markdown + frontmatter
- [ ] `POST /api/agent/docs` creates doc with `author_type: agent`, status `draft`
- [ ] `PUT /api/agent/docs/:id` updates doc body and re-embeds
- [ ] `POST /api/agent/docs/:id/review` sets status to `review`
- [ ] All agent endpoints return 401 for missing or revoked key
- [ ] Agent cannot access docs from a different workspace

**Linear Integration**
- [ ] Pasting a Linear URL in the linked field shows a preview (title, status) in the sidebar
- [ ] If `LINEAR_API_KEY` is not set, the field still works — just no preview

**Templates**
- [ ] Creating a new doc with type `prd` pre-populates the editor with the PRD template
- [ ] Same for `adr`, `runbook`, `fix_note`, `compliance`, `decision`
- [ ] Creating a doc with type `general` starts with an empty editor

---

## What Is NOT in Week 2

Do not build any of the following. They are Week 3 scope:

- Review queue UI (the page where humans review agent docs)
- AI summary button per doc
- "Ask a question" chat panel
- Email or Slack notifications
- Stale doc detection
- Docker Compose / self-host setup

---

## Quick Agent Test

After Week 2 is complete, run this curl sequence to verify the full agent flow end to end:

```bash
# 1. Check health
curl http://localhost:3000/api/agent/health \
  -H "Authorization: Bearer aqli_your_key"

# 2. Query context
curl "http://localhost:3000/api/agent/context?query=withdrawal+flow&limit=3" \
  -H "Authorization: Bearer aqli_your_key"

# 3. Create a doc
curl -X POST http://localhost:3000/api/agent/docs \
  -H "Authorization: Bearer aqli_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix: Test timeout",
    "type": "fix_note",
    "space": "engineering",
    "body_md": "## What was fixed\n\nThis is a test fix note created by an agent.\n\n## Root cause\n\nTest.",
    "agent_id": "test-agent"
  }'

# 4. Request review (use the id from step 3)
curl -X POST http://localhost:3000/api/agent/docs/{id}/review \
  -H "Authorization: Bearer aqli_your_key" \
  -H "Content-Type: application/json" \
  -d '{"note": "Please review this test doc."}'

# 5. Verify it appears in the human UI with amber indicator and status: review
```

---

*Aqli Week 2 Build Prompt — SIRO & CO — June 2026*
