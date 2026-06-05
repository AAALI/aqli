# Aqli — Week 1 Claude Code Build Prompt

> Paste this entire document into Claude Code at the start of the session.
> This is a self-contained build instruction. Do not skip any section.

---

## What You Are Building

You are building **Aqli** — an open source team knowledge base for human-agent teams. It is the shared context layer between humans who write docs and AI agents that read and write docs via a REST API.

This Week 1 build covers the **core foundation only**:
- Project scaffolding
- Database schema
- Authentication
- Spaces (folders for docs)
- Docs CRUD
- Tiptap editor with autosave
- Doc metadata
- Markdown export
- Full-text search

**Do not build the agent API, RAG layer, or AI features this week.** Those are Week 2. Stay strictly within the scope below.

---

## Repository

```
github.com/AAALI/aqli
```

All work goes into this repository. Initialise it as a Next.js 15 project in the root.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Use App Router exclusively. No Pages Router. |
| Language | TypeScript | Strict mode. No `any` types. |
| Styling | Tailwind CSS v4 | Utility-first. No CSS modules. |
| Database | Supabase (Postgres + Auth) | Use the Supabase JS client v2 |
| Editor | Tiptap v2 | Rich text editor. Client component only. |
| Package manager | pnpm | Not npm or yarn |

---

## Environment Variables

Create `.env.local` for development and `.env.example` with placeholder values committed to the repo.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-string-here
```

---

## Database Schema

Run this SQL in your Supabase project SQL editor. This is the complete Week 1 schema.

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spaces (Product, Engineering, Compliance, Ops, etc.)
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT DEFAULT '📄',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);

-- Docs
CREATE TABLE docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  type TEXT NOT NULL DEFAULT 'general',
  -- type: prd | adr | runbook | fix_note | compliance | decision | general
  status TEXT NOT NULL DEFAULT 'draft',
  -- status: draft | review | approved | stale | archived
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL DEFAULT 'human',
  -- author_type: human | agent
  agent_id TEXT,
  body_json JSONB,
  -- Tiptap JSON (source of truth for the editor)
  body_md TEXT,
  -- Markdown (regenerated on every save, used for search + export)
  frontmatter JSONB DEFAULT '{}',
  -- { tags: [], linked_project_url: '', linear_project_id: '' }
  last_reviewed_at TIMESTAMPTZ,
  search_vector TSVECTOR,
  -- generated from title + body_md for full-text search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX docs_search_idx ON docs USING gin(search_vector);

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION docs_update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body_md, '')), 'B');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER docs_search_vector_update
  BEFORE INSERT OR UPDATE ON docs
  FOR EACH ROW EXECUTE FUNCTION docs_update_search_vector();

-- Doc versions (snapshot on status change)
CREATE TABLE doc_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES docs(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  frontmatter JSONB,
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT,
  -- edit | status_change | created
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  -- role: admin | editor | viewer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Row-level security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Members can read their own workspace
CREATE POLICY "Members can read workspace"
  ON workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Members can read spaces in their workspace
CREATE POLICY "Members can read spaces"
  ON spaces FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Admins and editors can insert/update spaces
CREATE POLICY "Editors can manage spaces"
  ON spaces FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- Members can read docs in their workspace
CREATE POLICY "Members can read docs"
  ON docs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Editors and admins can create/update docs
CREATE POLICY "Editors can manage docs"
  ON docs FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- Members can read doc versions
CREATE POLICY "Members can read doc versions"
  ON doc_versions FOR SELECT
  USING (
    doc_id IN (
      SELECT id FROM docs WHERE workspace_id IN (
        SELECT workspace_id FROM members WHERE user_id = auth.uid()
      )
    )
  );
```

---

## Directory Structure

Scaffold exactly this structure:

```
aqli/
├── app/
│   ├── layout.tsx                    # Root layout, Tailwind, fonts
│   ├── page.tsx                      # Redirect: /login or /w/[workspace]
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # Email + password login
│   │   └── signup/
│   │       └── page.tsx              # Create account + workspace
│   │
│   ├── (app)/
│   │   └── w/
│   │       └── [workspace]/
│   │           ├── layout.tsx        # App shell: left sidebar + top bar
│   │           ├── page.tsx          # Home: recent docs
│   │           ├── s/
│   │           │   └── [space]/
│   │           │       ├── page.tsx  # Space: doc list
│   │           │       └── new/
│   │           │           └── page.tsx
│   │           ├── docs/
│   │           │   └── [id]/
│   │           │       ├── page.tsx  # Doc viewer
│   │           │       └── edit/
│   │           │           └── page.tsx
│   │           └── search/
│   │               └── page.tsx
│   │
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts
│       ├── workspaces/
│       │   └── route.ts
│       ├── spaces/
│       │   ├── route.ts
│       │   └── [id]/
│       │       └── route.ts
│       ├── docs/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── versions/
│       │           └── route.ts
│       └── search/
│           └── route.ts
│
├── components/
│   ├── editor/
│   │   ├── AqliEditor.tsx            # Tiptap editor wrapper (client component)
│   │   └── EditorToolbar.tsx
│   ├── docs/
│   │   ├── DocCard.tsx
│   │   ├── DocList.tsx
│   │   ├── DocMeta.tsx               # Title, type, status, owner, tags fields
│   │   └── DocStatusBadge.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx               # Left sidebar: spaces + nav
│   │   ├── TopBar.tsx
│   │   └── SpaceNav.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       └── Dialog.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server Supabase client (uses service key)
│   │   ├── docs.ts                   # Doc CRUD functions
│   │   ├── spaces.ts                 # Space CRUD functions
│   │   └── workspaces.ts             # Workspace functions
│   ├── markdown/
│   │   ├── tiptap-to-md.ts           # Convert Tiptap JSON → Markdown string
│   │   └── md-to-tiptap.ts           # Convert Markdown string → Tiptap JSON
│   └── utils.ts                      # cn(), slugify(), formatDate()
│
├── types/
│   ├── doc.ts
│   ├── space.ts
│   └── workspace.ts
│
├── .env.example
├── .env.local                        # gitignored
├── .gitignore
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## TypeScript Types

Define these in `types/` before writing any components or API routes.

```typescript
// types/workspace.ts
export type Workspace = {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
}

export type Member = {
  id: string
  workspace_id: string
  user_id: string
  role: 'admin' | 'editor' | 'viewer'
  created_at: string
}

// types/space.ts
export type Space = {
  id: string
  workspace_id: string
  name: string
  slug: string
  icon: string
  created_at: string
}

// types/doc.ts
export type DocType =
  | 'prd'
  | 'adr'
  | 'runbook'
  | 'fix_note'
  | 'compliance'
  | 'decision'
  | 'general'

export type DocStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'stale'
  | 'archived'

export type AuthorType = 'human' | 'agent'

export type DocFrontmatter = {
  tags: string[]
  linked_project_url?: string
  linear_project_id?: string
}

export type Doc = {
  id: string
  workspace_id: string
  space_id: string | null
  title: string
  type: DocType
  status: DocStatus
  owner_id: string | null
  author_type: AuthorType
  agent_id: string | null
  body_json: Record<string, unknown> | null  // Tiptap JSON
  body_md: string | null
  frontmatter: DocFrontmatter
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type DocVersion = {
  id: string
  doc_id: string
  version_number: number
  body_md: string
  frontmatter: DocFrontmatter | null
  changed_by: string | null
  change_type: 'edit' | 'status_change' | 'created'
  created_at: string
}

export type DocWithSpace = Doc & {
  space: Space | null
}
```

---

## Supabase Client Setup

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Service client for server-side operations that bypass RLS
export function createServiceClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}
```

---

## Tiptap Editor

```typescript
// components/editor/AqliEditor.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCallback, useEffect } from 'react'
import EditorToolbar from './EditorToolbar'

type Props = {
  initialContent?: Record<string, unknown> | null
  onChange: (json: Record<string, unknown>, markdown: string) => void
  placeholder?: string
  editable?: boolean
}

export default function AqliEditor({
  initialContent,
  onChange,
  placeholder = 'Start writing...',
  editable = true,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: 'language-' },
      }),
    ],
    content: initialContent ?? {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    editable,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const markdown = editorToMarkdown(editor)
      onChange(json, markdown)
    },
  })

  // Clean up on unmount
  useEffect(() => {
    return () => { editor?.destroy() }
  }, [editor])

  return (
    <div className="flex flex-col h-full">
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto prose prose-neutral max-w-none px-8 py-6 focus:outline-none"
      />
    </div>
  )
}

// Simple Tiptap JSON → Markdown converter
// This is intentionally basic for Week 1 — replace with a proper library in Week 2
function editorToMarkdown(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return ''
  const json = editor.getJSON()
  return nodesToMarkdown(json.content ?? [])
}

function nodesToMarkdown(nodes: unknown[]): string {
  return nodes.map((node: any) => {
    switch (node.type) {
      case 'heading':
        return `${'#'.repeat(node.attrs?.level ?? 1)} ${inlineToText(node.content)}\n\n`
      case 'paragraph':
        return `${inlineToText(node.content)}\n\n`
      case 'bulletList':
        return node.content.map((item: any) =>
          `- ${inlineToText(item.content?.[0]?.content)}`
        ).join('\n') + '\n\n'
      case 'orderedList':
        return node.content.map((item: any, i: number) =>
          `${i + 1}. ${inlineToText(item.content?.[0]?.content)}`
        ).join('\n') + '\n\n'
      case 'codeBlock':
        return `\`\`\`${node.attrs?.language ?? ''}\n${inlineToText(node.content)}\n\`\`\`\n\n`
      case 'blockquote':
        return `> ${inlineToText(node.content?.[0]?.content)}\n\n`
      case 'horizontalRule':
        return `---\n\n`
      default:
        return ''
    }
  }).join('')
}

function inlineToText(nodes: unknown[] = []): string {
  return (nodes as any[]).map((node: any) => {
    if (node.type === 'text') {
      let text = node.text ?? ''
      if (node.marks?.some((m: any) => m.type === 'bold')) text = `**${text}**`
      if (node.marks?.some((m: any) => m.type === 'italic')) text = `*${text}*`
      if (node.marks?.some((m: any) => m.type === 'code')) text = `\`${text}\``
      return text
    }
    return ''
  }).join('')
}
```

---

## Doc CRUD Library

```typescript
// lib/supabase/docs.ts
import { createServiceClient } from './server'
import type { Doc, DocType, DocStatus, DocFrontmatter } from '@/types/doc'

export async function getDocs(
  workspaceId: string,
  options?: {
    spaceId?: string
    type?: DocType
    status?: DocStatus
    limit?: number
    offset?: number
  }
) {
  const supabase = createServiceClient()
  let query = supabase
    .from('docs')
    .select('*, space:spaces(id, name, slug, icon)')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  if (options?.spaceId) query = query.eq('space_id', options.spaceId)
  if (options?.type) query = query.eq('type', options.type)
  if (options?.status) query = query.eq('status', options.status)
  if (options?.limit) query = query.limit(options.limit)
  if (options?.offset) query = query.range(
    options.offset,
    options.offset + (options.limit ?? 20) - 1
  )

  const { data, error } = await query
  if (error) throw error
  return data as Doc[]
}

export async function getDoc(id: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('docs')
    .select('*, space:spaces(id, name, slug, icon)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Doc
}

export async function createDoc(payload: {
  workspace_id: string
  space_id?: string
  title?: string
  type?: DocType
  owner_id?: string
  body_json?: Record<string, unknown>
  body_md?: string
  frontmatter?: DocFrontmatter
}) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('docs')
    .insert({
      ...payload,
      title: payload.title ?? 'Untitled',
      type: payload.type ?? 'general',
      status: 'draft',
      author_type: 'human',
      frontmatter: payload.frontmatter ?? { tags: [] },
    })
    .select()
    .single()
  if (error) throw error
  return data as Doc
}

export async function updateDoc(
  id: string,
  updates: Partial<Pick<Doc,
    | 'title'
    | 'type'
    | 'status'
    | 'owner_id'
    | 'body_json'
    | 'body_md'
    | 'frontmatter'
    | 'space_id'
    | 'last_reviewed_at'
  >>
) {
  const supabase = createServiceClient()

  // Snapshot a version if status is changing
  if (updates.status) {
    const current = await getDoc(id)
    if (current.status !== updates.status && current.body_md) {
      await snapshotVersion(id, current.body_md, current.frontmatter, 'status_change')
    }
  }

  const { data, error } = await supabase
    .from('docs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Doc
}

export async function deleteDoc(id: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('docs').delete().eq('id', id)
  if (error) throw error
}

export async function snapshotVersion(
  docId: string,
  bodyMd: string,
  frontmatter: DocFrontmatter | null,
  changeType: 'edit' | 'status_change' | 'created',
  changedBy?: string
) {
  const supabase = createServiceClient()

  // Get current highest version number
  const { data: versions } = await supabase
    .from('doc_versions')
    .select('version_number')
    .eq('doc_id', docId)
    .order('version_number', { ascending: false })
    .limit(1)

  const nextVersion = ((versions?.[0]?.version_number ?? 0) + 1)

  await supabase.from('doc_versions').insert({
    doc_id: docId,
    version_number: nextVersion,
    body_md: bodyMd,
    frontmatter,
    changed_by: changedBy ?? null,
    change_type: changeType,
  })
}

export async function searchDocs(workspaceId: string, query: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('docs')
    .select('id, title, type, status, space_id, updated_at, body_md')
    .eq('workspace_id', workspaceId)
    .textSearch('search_vector', query, { type: 'websearch' })
    .limit(20)
  if (error) throw error
  return data
}
```

---

## API Routes

### Docs list + create

```typescript
// app/api/docs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDocs, createDoc } from '@/lib/supabase/docs'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const docs = await getDocs(workspaceId, {
    spaceId: searchParams.get('space_id') ?? undefined,
    type: searchParams.get('type') as any ?? undefined,
    status: searchParams.get('status') as any ?? undefined,
    limit: Number(searchParams.get('limit') ?? 50),
    offset: Number(searchParams.get('offset') ?? 0),
  })

  return NextResponse.json({ docs })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const doc = await createDoc({ ...body, owner_id: user.id })
  return NextResponse.json({ doc }, { status: 201 })
}
```

### Doc get + update + delete

```typescript
// app/api/docs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDoc, updateDoc, deleteDoc } from '@/lib/supabase/docs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await getDoc(params.id)
  return NextResponse.json({ doc })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates = await req.json()
  const doc = await updateDoc(params.id, updates)
  return NextResponse.json({ doc })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await deleteDoc(params.id)
  return NextResponse.json({ success: true })
}
```

### Search

```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { searchDocs } from '@/lib/supabase/docs'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const workspaceId = searchParams.get('workspace_id')

  if (!query || !workspaceId) {
    return NextResponse.json({ error: 'q and workspace_id required' }, { status: 400 })
  }

  const results = await searchDocs(workspaceId, query)
  return NextResponse.json({ results })
}
```

---

## Doc Editor Page

```typescript
// app/(app)/w/[workspace]/docs/[id]/edit/page.tsx
import { notFound } from 'next/navigation'
import { getDoc } from '@/lib/supabase/docs'
import DocEditorClient from './DocEditorClient'

export default async function DocEditPage({
  params,
}: {
  params: { workspace: string; id: string }
}) {
  const doc = await getDoc(params.id).catch(() => null)
  if (!doc) notFound()

  return <DocEditorClient doc={doc} workspaceSlug={params.workspace} />
}
```

```typescript
// app/(app)/w/[workspace]/docs/[id]/edit/DocEditorClient.tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import AqliEditor from '@/components/editor/AqliEditor'
import DocMeta from '@/components/docs/DocMeta'
import type { Doc } from '@/types/doc'

type Props = {
  doc: Doc
  workspaceSlug: string
}

export default function DocEditorClient({ doc, workspaceSlug }: Props) {
  const [title, setTitle] = useState(doc.title)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimer = useRef<NodeJS.Timeout>()

  const save = useCallback(async (
    json: Record<string, unknown>,
    markdown: string
  ) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch(`/api/docs/${doc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body_json: json, body_md: markdown }),
        })
        setLastSaved(new Date())
      } finally {
        setSaving(false)
      }
    }, 2000) // 2s debounce
  }, [doc.id])

  const saveTitle = useCallback(async (newTitle: string) => {
    await fetch(`/api/docs/${doc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
  }, [doc.id])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-3 border-b border-neutral-200">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={e => saveTitle(e.target.value)}
            className="text-2xl font-semibold bg-transparent border-none outline-none w-full"
            placeholder="Untitled"
          />
          <span className="text-sm text-neutral-400 ml-4 shrink-0">
            {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
          </span>
        </div>

        {/* Doc metadata bar */}
        <DocMeta doc={doc} workspaceSlug={workspaceSlug} />

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <AqliEditor
            initialContent={doc.body_json}
            onChange={save}
          />
        </div>
      </div>
    </div>
  )
}
```

---

## DocMeta Component

```typescript
// components/docs/DocMeta.tsx
'use client'

import { useState } from 'react'
import DocStatusBadge from './DocStatusBadge'
import type { Doc, DocType, DocStatus } from '@/types/doc'

const DOC_TYPES: DocType[] = [
  'prd', 'adr', 'runbook', 'fix_note', 'compliance', 'decision', 'general'
]

const DOC_STATUSES: DocStatus[] = [
  'draft', 'review', 'approved', 'stale', 'archived'
]

type Props = {
  doc: Doc
  workspaceSlug: string
}

export default function DocMeta({ doc, workspaceSlug }: Props) {
  const [type, setType] = useState<DocType>(doc.type)
  const [status, setStatus] = useState<DocStatus>(doc.status)
  const [tags, setTags] = useState<string[]>(doc.frontmatter?.tags ?? [])
  const [linkedUrl, setLinkedUrl] = useState(doc.frontmatter?.linked_project_url ?? '')

  const update = async (updates: Partial<Doc>) => {
    await fetch(`/api/docs/${doc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  return (
    <div className="flex items-center gap-4 px-8 py-2 border-b border-neutral-100 text-sm text-neutral-600 flex-wrap">
      {/* Type */}
      <select
        value={type}
        onChange={e => {
          setType(e.target.value as DocType)
          update({ type: e.target.value as DocType })
        }}
        className="bg-neutral-100 rounded px-2 py-1 text-xs font-medium capitalize"
      >
        {DOC_TYPES.map(t => (
          <option key={t} value={t}>{t.replace('_', ' ')}</option>
        ))}
      </select>

      {/* Status */}
      <select
        value={status}
        onChange={e => {
          setStatus(e.target.value as DocStatus)
          update({ status: e.target.value as DocStatus })
        }}
        className="bg-neutral-100 rounded px-2 py-1 text-xs font-medium capitalize"
      >
        {DOC_STATUSES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Linked project URL */}
      <input
        type="text"
        value={linkedUrl}
        onChange={e => setLinkedUrl(e.target.value)}
        onBlur={e => update({
          frontmatter: { ...doc.frontmatter, linked_project_url: e.target.value }
        })}
        placeholder="Paste Linear / GitHub project URL"
        className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-xs w-64"
      />

      {/* Last updated */}
      <span className="text-neutral-400 text-xs ml-auto">
        Updated {new Date(doc.updated_at).toLocaleDateString()}
      </span>
    </div>
  )
}
```

---

## Sidebar Layout

```typescript
// components/layout/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Space } from '@/types/space'

type Props = {
  workspaceSlug: string
  spaces: Space[]
  workspaceName: string
}

export default function Sidebar({ workspaceSlug, spaces, workspaceName }: Props) {
  const pathname = usePathname()

  return (
    <div className="w-56 shrink-0 h-screen border-r border-neutral-200 flex flex-col bg-neutral-50">
      {/* Workspace name */}
      <div className="px-4 py-4 border-b border-neutral-200">
        <span className="font-semibold text-sm text-neutral-800">{workspaceName}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <Link
          href={`/w/${workspaceSlug}`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm mb-1 ${
            pathname === `/w/${workspaceSlug}`
              ? 'bg-neutral-200 text-neutral-900'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          🏠 Home
        </Link>

        <Link
          href={`/w/${workspaceSlug}/search`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm mb-3 ${
            pathname.includes('/search')
              ? 'bg-neutral-200 text-neutral-900'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          🔍 Search
        </Link>

        {/* Spaces */}
        <p className="px-3 text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">
          Spaces
        </p>
        {spaces.map(space => (
          <Link
            key={space.id}
            href={`/w/${workspaceSlug}/s/${space.slug}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
              pathname.includes(`/s/${space.slug}`)
                ? 'bg-neutral-200 text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {space.icon} {space.name}
          </Link>
        ))}
      </nav>

      {/* Settings */}
      <div className="border-t border-neutral-200 px-2 py-3">
        <Link
          href={`/w/${workspaceSlug}/settings`}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-neutral-600 hover:bg-neutral-100"
        >
          ⚙️ Settings
        </Link>
      </div>
    </div>
  )
}
```

---

## package.json Dependencies

```json
{
  "name": "aqli",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.45.0",
    "@tiptap/extension-code-block": "^2.7.0",
    "@tiptap/extension-heading": "^2.7.0",
    "@tiptap/extension-placeholder": "^2.7.0",
    "@tiptap/react": "^2.7.0",
    "@tiptap/starter-kit": "^2.7.0",
    "next": "15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/forms": "^0.5.9",
    "typescript": "^5.6.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "15.0.0"
  }
}
```

---

## Week 1 Acceptance Checklist

Before closing this session, verify every item:

**Auth**
- [ ] User can sign up with email + password
- [ ] User can log in and is redirected to their workspace
- [ ] Unauthenticated users are redirected to `/login`
- [ ] Session persists on refresh

**Workspace + Spaces**
- [ ] Workspace is created on signup
- [ ] Spaces can be created (name + icon)
- [ ] Spaces appear in the sidebar
- [ ] Clicking a space shows its doc list

**Docs**
- [ ] New doc can be created from a space
- [ ] Doc opens in the Tiptap editor
- [ ] Typing in the editor autosaves after 2 seconds
- [ ] Title is editable inline and saves on blur
- [ ] Type and status dropdowns update the doc
- [ ] Linked project URL field saves to frontmatter
- [ ] Docs list shows title, type, status, last updated

**Search**
- [ ] Search page accepts a query
- [ ] Results return matching docs by title and body content
- [ ] Empty state shows when no results found

**Markdown**
- [ ] Saving a doc generates `body_md` from the Tiptap JSON
- [ ] Markdown is stored in the `docs` table
- [ ] A "Download Markdown" button exports the doc as a `.md` file

**Version History**
- [ ] Changing doc status creates a version snapshot in `doc_versions`
- [ ] Version history is visible on the doc page (list of versions with timestamp)

---

## What Is NOT in Week 1

Do not build any of the following. They are Week 2 and Week 3 scope:

- Agent API (`/api/agent/*`)
- API key management
- OpenAI embeddings or pgvector
- RAG context query
- AI summary or Q&A
- Linear integration
- Review queue
- Notifications
- Docker Compose / self-host setup
- Multi-workspace support

---

## README for Week 1

Commit this as `README.md`:

```markdown
# Aqli

> The shared intellect for human-agent teams.

An open source team knowledge base where humans write docs,
agents read context, agents write output, and humans review and approve.

## Status

🚧 Week 1 — Core foundation in progress

## Stack

- Next.js 15 (App Router)
- Supabase (Postgres + Auth)
- Tiptap v2
- Tailwind CSS

## Development

    pnpm install
    cp .env.example .env.local
    # Add your Supabase credentials to .env.local
    pnpm dev

## Roadmap

- [x] Week 1: Editor, spaces, docs, search
- [ ] Week 2: Agent API, RAG, embeddings
- [ ] Week 3: Review loop, AI features, Linear
- [ ] Week 4: Self-host, Docker Compose, open source release

## License

MIT — github.com/AAALI/aqli
```

---

*Aqli Week 1 Build Prompt — SIRO & CO — June 2026*
