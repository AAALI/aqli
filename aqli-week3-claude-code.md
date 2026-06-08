# Aqli — Week 3 Claude Code Build Prompt

> Paste this entire document into Claude Code at the start of the session.
> This is a self-contained build instruction. Do not skip any section.
> Weeks 1 and 2 must be fully complete before starting this session.

---

## Context

You are continuing to build **Aqli** — an open source team knowledge base for human-agent teams. Repository: `github.com/AAALI/aqli`.

**Week 1 delivered:** Editor, spaces, docs CRUD, autosave, full-text search, version history, Markdown export.

**Week 2 delivered:** pgvector embeddings, RAG pipeline, API key management, full agent REST API, Linear URL preview, doc templates.

**Week 3 delivers the human-agent collaboration layer** — the features that make the human side of Aqli genuinely useful and differentiated. This week closes the loop between agent output and human approval, adds AI-powered features to the editor, and adds operational hygiene tooling.

---

## Week 3 Scope

Build exactly these things in order:

1. **Review queue** — UI for humans to review, approve, or reject agent-authored docs
2. **AI doc summary** — one-click AI summary of any doc
3. **Ask a question** — multi-doc RAG chat panel in the editor sidebar
4. **Stale doc detection** — flag docs not reviewed in N days
5. **Doc activity feed** — per-doc timeline of all changes (human and agent)
6. **Agent write log** — workspace-level feed of all agent activity

**Do not build this week:**
- Docker Compose (Week 4)
- Multi-workspace support (Week 4)
- Public open source release prep (Week 4)
- Slack/email notifications (deprioritised — ship without)

---

## No New Environment Variables

Week 3 uses the same environment as Week 2. No additions needed.

---

## Step 1 — Database Migration

Run this SQL in Supabase before writing any code.

```sql
-- Doc comments (for review feedback)
CREATE TABLE doc_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES docs(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'comment',
  -- comment_type: comment | review_request | approval | rejection | change_request
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doc activity log
CREATE TABLE doc_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES docs(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'human',
  -- actor_type: human | agent
  actor_id TEXT,
  -- user UUID for humans, agent_id string for agents
  actor_name TEXT,
  action TEXT NOT NULL,
  -- action: created | updated | status_changed | reviewed | approved | rejected | changes_requested | embedded
  metadata JSONB DEFAULT '{}',
  -- { from_status, to_status, agent_id, pr_url, etc }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX doc_comments_doc_id_idx ON doc_comments(doc_id);
CREATE INDEX doc_activity_doc_id_idx ON doc_activity(doc_id);
CREATE INDEX doc_activity_workspace_id_idx ON doc_activity(workspace_id);
CREATE INDEX doc_activity_actor_type_idx ON doc_activity(actor_type);

-- RLS
ALTER TABLE doc_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read comments in their workspace"
  ON doc_comments FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create comments"
  ON doc_comments FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can read activity in their workspace"
  ON doc_activity FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );
```

---

## Step 2 — New TypeScript Types

```typescript
// types/activity.ts
export type ActorType = 'human' | 'agent'

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'reviewed'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'embedded'
  | 'review_requested'

export type DocActivity = {
  id: string
  doc_id: string
  workspace_id: string
  actor_type: ActorType
  actor_id: string | null
  actor_name: string | null
  action: ActivityAction
  metadata: Record<string, unknown>
  created_at: string
}

// types/comment.ts
export type CommentType =
  | 'comment'
  | 'review_request'
  | 'approval'
  | 'rejection'
  | 'change_request'

export type DocComment = {
  id: string
  doc_id: string
  workspace_id: string
  author_id: string | null
  body: string
  comment_type: CommentType
  created_at: string
}
```

---

## Step 3 — Activity Logging Library

This utility is called from doc mutations throughout the app. Wire it into every place a doc changes state.

```typescript
// lib/supabase/activity.ts
import { createServiceClient } from './server'
import type { ActivityAction, ActorType } from '@/types/activity'

export async function logActivity({
  docId,
  workspaceId,
  actorType,
  actorId,
  actorName,
  action,
  metadata = {},
}: {
  docId: string
  workspaceId: string
  actorType: ActorType
  actorId: string | null
  actorName: string | null
  action: ActivityAction
  metadata?: Record<string, unknown>
}) {
  const supabase = createServiceClient()
  await supabase.from('doc_activity').insert({
    doc_id: docId,
    workspace_id: workspaceId,
    actor_type: actorType,
    actor_id: actorId,
    actor_name: actorName,
    action,
    metadata,
  })
  // Fire and forget — activity logging never blocks the main operation
}

export async function getDocActivity(docId: string, limit = 50) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('doc_activity')
    .select('*')
    .eq('doc_id', docId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getWorkspaceAgentActivity(workspaceId: string, limit = 50) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('doc_activity')
    .select('*, doc:docs(id, title, type, status, space_id)')
    .eq('workspace_id', workspaceId)
    .eq('actor_type', 'agent')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
```

### Wire activity logging into existing mutations

Update these existing functions to log activity:

**`lib/supabase/docs.ts` — `updateDoc`:** After a successful update, call `logActivity` with action `updated` or `status_changed` if status changed.

**`lib/supabase/docs.ts` — `createDoc`:** After creation, call `logActivity` with action `created`.

**`app/api/agent/docs/route.ts` — POST:** After agent creates a doc, log `created` with `actorType: 'agent'` and `actorId: agent_id`.

**`app/api/agent/docs/[id]/review/route.ts` — POST:** After review request, log `review_requested` with `actorType: 'agent'`.

---

## Step 4 — Review Queue

This is the most important UI in Week 3. It is the page where humans see and act on all agent-authored docs.

### Route

```
app/(app)/w/[workspace]/review/page.tsx
```

Add "Review" link to the sidebar navigation with a badge showing the count of pending docs.

### Data fetching

```typescript
// lib/supabase/review.ts
import { createServiceClient } from './server'
import type { Doc } from '@/types/doc'

export async function getPendingReviewDocs(workspaceId: string): Promise<Doc[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('docs')
    .select('*, space:spaces(id, name, slug, icon)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'review')
    .order('updated_at', { ascending: true })
    // Oldest first — review queue works FIFO
  if (error) throw error
  return data as Doc[]
}

export async function getReviewCount(workspaceId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('docs')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'review')
  if (error) throw error
  return count ?? 0
}

export async function approveDoc(
  docId: string,
  reviewerId: string,
  reviewerName: string,
  workspaceId: string
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('docs')
    .update({
      status: 'approved',
      last_reviewed_at: new Date().toISOString(),
    })
    .eq('id', docId)

  await logActivity({
    docId,
    workspaceId,
    actorType: 'human',
    actorId: reviewerId,
    actorName: reviewerName,
    action: 'approved',
  })
}

export async function rejectDoc(
  docId: string,
  reviewerId: string,
  reviewerName: string,
  workspaceId: string,
  reason: string
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('docs')
    .update({ status: 'draft' })
    // Rejected docs go back to draft — agent can revise and re-request review
    .eq('id', docId)

  // Store rejection reason as a comment
  await supabase.from('doc_comments').insert({
    doc_id: docId,
    workspace_id: workspaceId,
    author_id: reviewerId,
    body: reason,
    comment_type: 'rejection',
  })

  await logActivity({
    docId,
    workspaceId,
    actorType: 'human',
    actorId: reviewerId,
    actorName: reviewerName,
    action: 'rejected',
    metadata: { reason },
  })
}

export async function requestChanges(
  docId: string,
  reviewerId: string,
  reviewerName: string,
  workspaceId: string,
  note: string
): Promise<void> {
  const supabase = createServiceClient()
  // Status stays 'review' — it stays in the queue but with a note
  await supabase.from('doc_comments').insert({
    doc_id: docId,
    workspace_id: workspaceId,
    author_id: reviewerId,
    body: note,
    comment_type: 'change_request',
  })

  await logActivity({
    docId,
    workspaceId,
    actorType: 'human',
    actorId: reviewerId,
    actorName: reviewerName,
    action: 'changes_requested',
    metadata: { note },
  })
}
```

### Review queue API routes

```typescript
// app/api/review/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPendingReviewDocs, getReviewCount } from '@/lib/supabase/review'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const [docs, count] = await Promise.all([
    getPendingReviewDocs(workspaceId),
    getReviewCount(workspaceId),
  ])

  return NextResponse.json({ docs, count })
}

// app/api/review/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { approveDoc, rejectDoc, requestChanges } from '@/lib/supabase/review'
import { embedDoc } from '@/lib/ai/embedder'
import { getDoc } from '@/lib/supabase/docs'
import { getSpace } from '@/lib/supabase/spaces'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, reason, note, workspace_id } = await req.json()
  const reviewerName = user.email ?? user.id

  if (action === 'approve') {
    await approveDoc(params.id, user.id, reviewerName, workspace_id)

    // Re-embed now that doc is approved — agents can now find it in context queries
    const doc = await getDoc(params.id)
    if (doc.space_id) {
      const space = await getSpace(doc.space_id)
      embedDoc(doc, space?.name ?? 'Unknown').catch(console.error)
    }

    return NextResponse.json({ status: 'approved' })
  }

  if (action === 'reject') {
    await rejectDoc(params.id, user.id, reviewerName, workspace_id, reason ?? 'No reason given')
    return NextResponse.json({ status: 'rejected' })
  }

  if (action === 'request_changes') {
    await requestChanges(params.id, user.id, reviewerName, workspace_id, note ?? '')
    return NextResponse.json({ status: 'changes_requested' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
```

### Review queue page component

```typescript
// app/(app)/w/[workspace]/review/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPendingReviewDocs } from '@/lib/supabase/review'
import { getWorkspaceBySlug } from '@/lib/supabase/workspaces'
import ReviewQueueClient from './ReviewQueueClient'

export default async function ReviewPage({
  params,
}: {
  params: { workspace: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const workspace = await getWorkspaceBySlug(params.workspace)
  if (!workspace) return null

  const docs = await getPendingReviewDocs(workspace.id)

  return (
    <ReviewQueueClient
      docs={docs}
      workspaceId={workspace.id}
      workspaceSlug={params.workspace}
    />
  )
}
```

```typescript
// app/(app)/w/[workspace]/review/ReviewQueueClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Doc } from '@/types/doc'

type Props = {
  docs: Doc[]
  workspaceId: string
  workspaceSlug: string
}

export default function ReviewQueueClient({ docs, workspaceId, workspaceSlug }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [changeNote, setChangeNote] = useState('')
  const [activeDialog, setActiveDialog] = useState<{
    type: 'reject' | 'changes'
    docId: string
  } | null>(null)

  const act = async (docId: string, action: string, extra?: Record<string, string>) => {
    setLoading(docId)
    try {
      await fetch(`/api/review/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, workspace_id: workspaceId, ...extra }),
      })
      router.refresh()
    } finally {
      setLoading(null)
      setActiveDialog(null)
      setRejectionReason('')
      setChangeNote('')
    }
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-neutral-400">
        <span className="text-4xl mb-3">✓</span>
        <p className="text-lg font-medium text-neutral-600">Review queue is clear</p>
        <p className="text-sm mt-1">No agent docs are waiting for review</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Review Queue</h1>
        <p className="text-neutral-500 mt-1">
          {docs.length} {docs.length === 1 ? 'doc' : 'docs'} waiting for review
        </p>
      </div>

      <div className="space-y-4">
        {docs.map(doc => (
          <div
            key={doc.id}
            className="border border-neutral-200 rounded-lg overflow-hidden bg-white"
            style={{ borderLeft: '3px solid #FAC775' }}
            // Amber left border — agent-authored indicator
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                      🤖 Agent authored
                    </span>
                    <span className="text-xs text-neutral-400 capitalize">
                      {doc.type.replace('_', ' ')}
                    </span>
                    {(doc as any).space && (
                      <span className="text-xs text-neutral-400">
                        · {(doc as any).space.name}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900">
                    {doc.title}
                  </h3>
                </div>
                <span className="text-xs text-neutral-400 shrink-0">
                  {new Date(doc.updated_at).toLocaleDateString()}
                </span>
              </div>

              {/* Body preview */}
              {doc.body_md && (
                <p className="text-sm text-neutral-600 line-clamp-3 mb-4">
                  {doc.body_md.replace(/^---[\s\S]*?---\n/, '').replace(/#{1,6}\s/g, '').trim()}
                </p>
              )}

              {/* Agent ID */}
              {doc.agent_id && (
                <p className="text-xs text-neutral-400 mb-4">
                  Written by: <span className="font-mono">{doc.agent_id}</span>
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <a
                  href={`/w/${workspaceSlug}/docs/${doc.id}`}
                  target="_blank"
                  className="text-sm text-neutral-500 hover:text-neutral-700 underline mr-2"
                >
                  Read full doc ↗
                </a>

                <button
                  onClick={() => act(doc.id, 'approve')}
                  disabled={loading === doc.id}
                  className="px-4 py-1.5 text-sm font-medium bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading === doc.id ? 'Approving...' : 'Approve'}
                </button>

                <button
                  onClick={() => setActiveDialog({ type: 'changes', docId: doc.id })}
                  disabled={loading === doc.id}
                  className="px-4 py-1.5 text-sm font-medium border border-neutral-300 rounded hover:bg-neutral-50 disabled:opacity-50"
                >
                  Request Changes
                </button>

                <button
                  onClick={() => setActiveDialog({ type: 'reject', docId: doc.id })}
                  disabled={loading === doc.id}
                  className="px-4 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>

            {/* Rejection dialog inline */}
            {activeDialog?.type === 'reject' && activeDialog.docId === doc.id && (
              <div className="border-t border-neutral-100 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-700 mb-2">Reason for rejection</p>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Explain why this doc is being rejected..."
                  className="w-full text-sm border border-red-200 rounded p-2 mb-2 bg-white resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => act(doc.id, 'reject', { reason: rejectionReason })}
                    className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => setActiveDialog(null)}
                    className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Request changes dialog inline */}
            {activeDialog?.type === 'changes' && activeDialog.docId === doc.id && (
              <div className="border-t border-neutral-100 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-700 mb-2">What needs to change?</p>
                <textarea
                  value={changeNote}
                  onChange={e => setChangeNote(e.target.value)}
                  placeholder="Describe what the agent should update..."
                  className="w-full text-sm border border-amber-200 rounded p-2 mb-2 bg-white resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => act(doc.id, 'request_changes', { note: changeNote })}
                    className="px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded hover:bg-amber-700"
                  >
                    Send Feedback
                  </button>
                  <button
                    onClick={() => setActiveDialog(null)}
                    className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Review count badge in sidebar

Update `components/layout/Sidebar.tsx` to show a badge on the Review link:

```typescript
// Add to Sidebar.tsx — fetch review count server-side and pass as prop

// In the nav section:
<Link href={`/w/${workspaceSlug}/review`} className={...}>
  📋 Review
  {reviewCount > 0 && (
    <span className="ml-auto bg-amber-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full">
      {reviewCount}
    </span>
  )}
</Link>
```

---

## Step 5 — AI Doc Summary

A button in the doc right sidebar that generates a plain-English summary of the current doc using GPT-4o-mini.

### Summary API route

```typescript
// app/api/ai/summary/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDoc } from '@/lib/supabase/docs'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { doc_id } = await req.json()
  if (!doc_id) return NextResponse.json({ error: 'doc_id required' }, { status: 400 })

  const doc = await getDoc(doc_id)
  if (!doc.body_md) {
    return NextResponse.json({ error: 'Doc has no content to summarise' }, { status: 400 })
  }

  const prompt = `You are summarising an internal team document for Aqli, a knowledge base.

Document type: ${doc.type.replace('_', ' ')}
Document title: ${doc.title}
Document status: ${doc.status}

Content:
${doc.body_md.slice(0, 4000)}

Write a concise summary in 3-5 sentences. Focus on:
1. What this document is about
2. The key decision, requirement, or finding
3. Who should read it and why

Write in plain English. No bullet points. No headings. Just clear prose.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.3,
  })

  const summary = response.choices[0]?.message?.content ?? 'Unable to generate summary.'

  return NextResponse.json({ summary })
}
```

### AI summary component

```typescript
// components/ai/DocSummary.tsx
'use client'

import { useState } from 'react'

type Props = {
  docId: string
}

export default function DocSummary({ docId }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: docId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSummary(data.summary)
    } catch (e) {
      setError('Failed to generate summary. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-neutral-100 pt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          AI Summary
        </p>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="text-xs text-teal-600 hover:text-teal-700 disabled:opacity-50"
        >
          {loading ? 'Generating...' : summary ? 'Regenerate' : '✦ Summarise'}
        </button>
      </div>

      {summary && (
        <p className="text-sm text-neutral-600 leading-relaxed">{summary}</p>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!summary && !loading && (
        <p className="text-xs text-neutral-400">
          Click Summarise to generate an AI summary of this doc.
        </p>
      )}
    </div>
  )
}
```

Add `<DocSummary docId={doc.id} />` to the right sidebar of the doc editor page, inside the sidebar panel below Linked Issues and Related Docs.

---

## Step 6 — Ask a Question (RAG Chat Panel)

A collapsible panel in the editor right sidebar. User types a question, gets an answer with source citations drawn from the workspace's approved docs.

### Q&A API route

```typescript
// app/api/ai/ask/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { queryContext } from '@/lib/ai/context'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, workspace_id } = await req.json()
  if (!question || !workspace_id) {
    return NextResponse.json({ error: 'question and workspace_id required' }, { status: 400 })
  }

  // Retrieve relevant context chunks
  const contextResults = await queryContext(workspace_id, question, {
    limit: 5,
    status: 'approved',
  })

  if (contextResults.length === 0) {
    return NextResponse.json({
      answer: 'No relevant approved docs found for this question. Try approving more docs or rephrasing your question.',
      sources: [],
    })
  }

  // Build context string for the prompt
  const contextText = contextResults
    .map((r, i) =>
      `[Source ${i + 1}: ${r.doc_title} — ${r.heading ?? 'Overview'}]\n${r.content}`
    )
    .join('\n\n---\n\n')

  const prompt = `You are Aqli, a knowledge assistant for an internal team knowledge base.
Answer the following question using ONLY the context provided below.
If the context does not contain enough information to answer, say so clearly.
Always cite which source(s) you used.

Context:
${contextText}

Question: ${question}

Answer concisely and accurately. At the end, list the sources you used as: "Sources: [Source 1], [Source 2]"`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.2,
  })

  const answer = response.choices[0]?.message?.content ?? 'Unable to generate answer.'

  return NextResponse.json({
    answer,
    sources: contextResults.map(r => ({
      doc_id: r.doc_id,
      doc_title: r.doc_title,
      heading: r.heading,
      source_url: r.source_url,
      score: r.score,
    })),
  })
}
```

### Ask question component

```typescript
// components/ai/AskQuestion.tsx
'use client'

import { useState } from 'react'

type Source = {
  doc_id: string
  doc_title: string
  heading: string | null
  source_url: string
  score: number
}

type Props = {
  workspaceId: string
}

export default function AskQuestion({ workspaceId }: Props) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const ask = async () => {
    if (!question.trim()) return
    setLoading(true)
    setAnswer(null)
    setSources([])
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, workspace_id: workspaceId }),
      })
      const data = await res.json()
      setAnswer(data.answer)
      setSources(data.sources ?? [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-neutral-100 pt-4">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center justify-between w-full text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2"
      >
        ✦ Ask Aqli
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="Ask a question about your docs..."
              className="flex-1 text-sm border border-neutral-200 rounded px-3 py-1.5 bg-neutral-50 focus:outline-none focus:border-teal-400"
            />
            <button
              onClick={ask}
              disabled={loading || !question.trim()}
              className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? '...' : 'Ask'}
            </button>
          </div>

          {answer && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-700 leading-relaxed">{answer}</p>

              {sources.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-400 mb-1">Sources</p>
                  <div className="space-y-1">
                    {sources.map(s => (
                      <a
                        key={s.doc_id}
                        href={s.source_url}
                        target="_blank"
                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700"
                      >
                        ↗ {s.doc_title}{s.heading ? ` — ${s.heading}` : ''}
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-400 mt-2">
                    Answer from approved docs only
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

Add `<AskQuestion workspaceId={workspace.id} />` to the doc editor right sidebar, below the AI Summary component.

---

## Step 7 — Stale Doc Detection

A doc is stale if it has not been reviewed in N days (default: 90). This runs as a check on the workspace home page and on a dedicated stale docs page.

### Stale detection utility

```typescript
// lib/supabase/stale.ts
import { createServiceClient } from './server'
import type { Doc } from '@/types/doc'

const DEFAULT_STALE_DAYS = 90

export async function getStaleDocs(
  workspaceId: string,
  staleDays = DEFAULT_STALE_DAYS
): Promise<Doc[]> {
  const supabase = createServiceClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - staleDays)

  const { data, error } = await supabase
    .from('docs')
    .select('*, space:spaces(id, name, slug, icon)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'approved')
    // Only approved docs go stale — drafts are expected to be incomplete
    .or(
      `last_reviewed_at.is.null,last_reviewed_at.lt.${cutoff.toISOString()}`
    )
    .order('last_reviewed_at', { ascending: true, nullsFirst: true })

  if (error) throw error
  return data as Doc[]
}

export async function getStaleCount(workspaceId: string): Promise<number> {
  const supabase = createServiceClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - DEFAULT_STALE_DAYS)

  const { count, error } = await supabase
    .from('docs')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'approved')
    .or(`last_reviewed_at.is.null,last_reviewed_at.lt.${cutoff.toISOString()}`)

  if (error) throw error
  return count ?? 0
}

export function daysSinceReview(doc: Doc): number | null {
  if (!doc.last_reviewed_at) return null
  const reviewed = new Date(doc.last_reviewed_at)
  const now = new Date()
  return Math.floor((now.getTime() - reviewed.getTime()) / (1000 * 60 * 60 * 24))
}
```

### Stale docs page

```
app/(app)/w/[workspace]/stale/page.tsx
```

The page shows:
- Header: "Stale Docs" with count
- Subtitle: "Approved docs not reviewed in 90+ days"
- List of stale docs with: title, space, type, last reviewed date, "Days since review" badge
- Each row has a "Mark as Reviewed" button that sets `last_reviewed_at` to now and status stays `approved`
- Empty state: "All your approved docs are up to date ✓"

Add a "Stale" link to the sidebar with a count badge (similar to Review).

### Mark as reviewed API

```typescript
// app/api/docs/[id]/reviewed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateDoc } from '@/lib/supabase/docs'
import { logActivity } from '@/lib/supabase/activity'
import { getDoc } from '@/lib/supabase/docs'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await getDoc(params.id)
  await updateDoc(params.id, {
    last_reviewed_at: new Date().toISOString(),
  })

  await logActivity({
    docId: params.id,
    workspaceId: doc.workspace_id,
    actorType: 'human',
    actorId: user.id,
    actorName: user.email ?? user.id,
    action: 'reviewed',
  })

  return NextResponse.json({ success: true })
}
```

---

## Step 8 — Doc Activity Feed

Show a timeline of all changes on a doc — both human and agent actions.

### Activity feed component

```typescript
// components/docs/DocActivityFeed.tsx
'use client'

import { useEffect, useState } from 'react'
import type { DocActivity } from '@/types/activity'

const ACTION_LABELS: Record<string, string> = {
  created: 'Created this doc',
  updated: 'Updated the content',
  status_changed: 'Changed status',
  reviewed: 'Marked as reviewed',
  approved: 'Approved this doc',
  rejected: 'Rejected this doc',
  changes_requested: 'Requested changes',
  embedded: 'Doc indexed by AI',
  review_requested: 'Requested human review',
}

type Props = {
  docId: string
}

export default function DocActivityFeed({ docId }: Props) {
  const [activities, setActivities] = useState<DocActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/docs/${docId}/activity`)
      .then(r => r.json())
      .then(d => setActivities(d.activities ?? []))
      .finally(() => setLoading(false))
  }, [docId])

  if (loading) return <p className="text-xs text-neutral-400">Loading activity...</p>
  if (activities.length === 0) return <p className="text-xs text-neutral-400">No activity yet</p>

  return (
    <div className="space-y-3">
      {activities.map(activity => (
        <div key={activity.id} className="flex gap-2 text-xs">
          <span className="shrink-0 mt-0.5">
            {activity.actor_type === 'agent' ? '🤖' : '👤'}
          </span>
          <div>
            <span className="font-medium text-neutral-700">
              {activity.actor_type === 'agent'
                ? (activity.actor_name ?? 'Agent')
                : (activity.actor_name ?? 'Team member')}
            </span>
            <span className="text-neutral-500 ml-1">
              {ACTION_LABELS[activity.action] ?? activity.action}
            </span>
            {activity.metadata?.to_status && (
              <span className="text-neutral-400 ml-1">
                → {String(activity.metadata.to_status)}
              </span>
            )}
            <div className="text-neutral-400 mt-0.5">
              {new Date(activity.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Activity API route

```typescript
// app/api/docs/[id]/activity/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDocActivity } from '@/lib/supabase/activity'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const activities = await getDocActivity(params.id)
  return NextResponse.json({ activities })
}
```

Add `<DocActivityFeed docId={doc.id} />` to the doc editor right sidebar, as a collapsible "Activity" panel at the bottom.

---

## Step 9 — Agent Write Log Page

A workspace-level page showing all agent activity across all docs — what agents have written, updated, and flagged for review.

```
app/(app)/w/[workspace]/agent-log/page.tsx
```

Show:
- Header: "Agent Activity"
- Subtitle: "All docs created or modified by AI agents"
- List of activity events filtered to `actor_type: agent`
- Each row: agent name (or ID), action, doc title (linked), space, timestamp
- Filter: All Actions · Created · Updated · Review Requested

Add "Agent Log" link to sidebar under the Review and Stale links.

### Agent log API route

```typescript
// app/api/agent-log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getWorkspaceAgentActivity } from '@/lib/supabase/activity'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const activities = await getWorkspaceAgentActivity(workspaceId)
  return NextResponse.json({ activities })
}
```

---

## Step 10 — Update README

Update `README.md` to reflect Week 3 completion:

```markdown
# Aqli

> The shared intellect for human-agent teams.

An open source team knowledge base where humans write docs,
agents read context, agents write output, and humans review and approve.

## Features

- ✅ Clean browser editor — write PRDs, ADRs, runbooks, fix notes
- ✅ Agent REST API — query context, create docs, request review
- ✅ Built-in RAG — every doc embedded and searchable by agents
- ✅ Human-agent review loop — agent docs flagged for human approval
- ✅ AI doc summary — one-click summary of any document
- ✅ Ask a question — RAG-backed Q&A across all approved docs
- ✅ Stale doc detection — flag approved docs not reviewed in 90 days
- ✅ Agent write log — full audit trail of agent activity
- ✅ Linear integration — link docs to projects and issues

## Stack

- Next.js 15 (App Router)
- Supabase (Postgres + pgvector + Auth)
- Tiptap v2
- OpenAI (text-embedding-3-small + gpt-4o-mini)
- Tailwind CSS

## Development

    pnpm install
    cp .env.example .env.local
    pnpm dev

## Agent API Quick Start

    # Query context before starting a task
    curl https://your-aqli.app/api/agent/context \
      -H "Authorization: Bearer aqli_your_key" \
      -G --data-urlencode "query=AED withdrawal flow"

    # Create a doc after completing work
    curl -X POST https://your-aqli.app/api/agent/docs \
      -H "Authorization: Bearer aqli_your_key" \
      -H "Content-Type: application/json" \
      -d '{"title":"Fix: timeout","type":"fix_note","body_md":"..."}'

Full API reference: docs/agent-api.md

## Roadmap

- [x] Week 1: Editor, spaces, docs, search
- [x] Week 2: Agent API, RAG, embeddings
- [x] Week 3: Review loop, AI features, stale detection
- [ ] Week 4: Self-host, Docker Compose, open source release

## License

MIT — github.com/AAALI/aqli
```

---

## Week 3 Acceptance Checklist

Before closing this session, verify every item:

**Database**
- [ ] `doc_comments` table exists with correct schema
- [ ] `doc_activity` table exists with correct schema

**Activity Logging**
- [ ] Creating a doc logs a `created` activity event
- [ ] Updating a doc logs an `updated` activity event
- [ ] Status change logs a `status_changed` event with `from_status` and `to_status` in metadata
- [ ] Agent creating a doc logs `created` with `actor_type: agent`
- [ ] Agent requesting review logs `review_requested` with `actor_type: agent`

**Review Queue**
- [ ] `/w/[workspace]/review` page loads and shows all docs with `status: review`
- [ ] Review count badge appears in sidebar when queue is non-empty
- [ ] Approve button sets status to `approved` and `last_reviewed_at` to now
- [ ] Approve triggers re-embedding so the doc enters agent context immediately
- [ ] Reject opens inline form, sets status back to `draft`, stores comment
- [ ] Request changes opens inline form, stores comment, doc stays in `review`
- [ ] Empty state shows when queue is clear
- [ ] Amber left border is visible on all review queue cards

**AI Summary**
- [ ] "Summarise" button appears in doc right sidebar
- [ ] Clicking it calls `/api/ai/summary` and displays the result
- [ ] "Regenerate" button appears after first summary
- [ ] Error state shows if API key is missing or call fails

**Ask a Question**
- [ ] "Ask Aqli" panel appears in doc right sidebar (collapsed by default)
- [ ] Typing a question and pressing Enter or clicking Ask calls `/api/ai/ask`
- [ ] Answer appears with source citations below
- [ ] Sources are clickable links to the source doc sections
- [ ] "Answer from approved docs only" disclaimer is visible

**Stale Detection**
- [ ] Stale docs page shows approved docs not reviewed in 90+ days
- [ ] Stale count badge appears in sidebar
- [ ] "Mark as Reviewed" button updates `last_reviewed_at` to now
- [ ] Doc disappears from stale list after marking reviewed
- [ ] Empty state shows when no stale docs

**Doc Activity Feed**
- [ ] Activity feed appears in doc right sidebar
- [ ] Human actions show with 👤 icon and email/name
- [ ] Agent actions show with 🤖 icon and agent_id
- [ ] Timestamps are correct and human-readable

**Agent Write Log**
- [ ] `/w/[workspace]/agent-log` page loads
- [ ] Shows all workspace activity where `actor_type = agent`
- [ ] Each row links to the relevant doc

---

## What Is NOT in Week 3

Do not build any of the following. They are Week 4 scope:

- Docker Compose and self-host setup
- Multi-workspace support
- Open source release preparation (README cleanup, demo, seed data)
- Email or Slack notifications
- CLI tool
- MCP server

---

*Aqli Week 3 Build Prompt — SIRO & CO — June 2026*
