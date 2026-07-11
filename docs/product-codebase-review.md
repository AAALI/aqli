# Aqli — Product & Codebase Review

> Full review of the product (against `aqli-product-docs.md` and the week 1–3
> briefs) and the codebase as of `main` @ `584ade6` (2026-07-11). Findings are
> ordered by severity; each includes the file/line and a suggested fix.
> Verified against the live Supabase project (`bxhagsiaenvcksckhize`):
> RLS policies, function definitions, and security advisors were inspected
> directly. `pnpm typecheck`, `pnpm lint`, and `pnpm test` (11 tests) all pass.

---

## Executive summary

The build is far ahead of the original Week 1 scope and the architecture is
mostly sound: RLS-first data access, hashed API keys, verified + idempotent
webhooks, a real RAG pipeline, and a clean separation between the RLS client
and the service-role client. The design system and UI conventions are
consistent and the tracker docs (`IMPLEMENTATION.md`, `docs/v2-remaining-checklist.md`)
are unusually well maintained.

The problems cluster in one place: **routes that use the service-role client
with caller-supplied IDs and no membership check**. Three endpoints let any
signed-in user — from *any* workspace, or no workspace at all — write into or
read from other workspaces. Two of them defeat the product's core trust loop
(they can inject or approve "trusted context" that agents will then consume).
These should be fixed before anything else ships.

The second theme is a **product deviation**: the PRD's P0 review loop says
agent-authored docs land in Draft and humans approve them, but the agent API
unconditionally auto-approves on write. Combined with GitHub auto-approve
defaulting to ON, the review queue — the product's differentiator — is empty
by default.

---

## 1. Critical — fix before launch

### 1.1 `POST /api/review/[id]` — any user can approve/reject any doc in any workspace

`app/api/review/[id]/route.ts:19-65` takes `workspace_id` from the request
body and never checks membership. `approveDoc` / `rejectDoc` /
`requestChanges` (`lib/supabase/review.ts:33-112`) all use
`createServiceClient()` and update by doc ID alone — they don't even verify
the doc belongs to the supplied `workspace_id`.

Impact: any authenticated user (including one who just signed up with no
workspace, or a **viewer** whose invite screen promises "cannot write or
approve docs") can flip any doc in any workspace to `approved`. Approved docs
are exactly what `/api/agent/context` serves to agents — this is a
cross-tenant context-poisoning primitive, and it also allows inserting
comments/activity rows into arbitrary workspaces.

Fix:
1. Load the doc via the RLS client first; 404 if not visible.
2. Require `getMyRole(doc.workspace_id)` ∈ {admin, editor} (not the
   body-supplied workspace_id — derive it from the doc).
3. Scope the service-role updates with `.eq("workspace_id", doc.workspace_id)`
   as a belt-and-braces measure.

### 1.2 `POST /api/integrations/composio/simulate` — unauthenticated-workspace doc injection

`app/api/integrations/composio/simulate/route.ts:6-30` requires only a signed-in
user. It accepts an arbitrary `workspace_id` plus a caller-crafted "PR event",
**creates an integration connection row** for that workspace via the
service-role client if none exists, and then runs the full PR→doc pipeline —
creating or patching docs as `approved` in a workspace the caller may have no
relationship to.

Fix: require `getMyRole(workspace_id) === "admin"`, and gate the whole route
behind a dev/test flag (e.g. `if (process.env.NODE_ENV === "production" && !process.env.ALLOW_SIMULATE) return 404`).
A simulation endpoint probably shouldn't exist on the production worker at all.

### 1.3 `GET /api/docs/[id]/activity` — cross-workspace activity read (IDOR)

`app/api/docs/[id]/activity/route.ts:16-17` calls `getDocActivity`
(`lib/supabase/activity.ts:101-114`, service-role) with only a login check.
Any authenticated user who obtains a doc UUID can read its full activity
trail (actor names, emails via `actor_name`, review notes in metadata).

Fix: fetch the doc through the RLS client first and 404 when invisible — or
change `getDocActivity` to use `createServerSupabaseClient()` (a
`doc_activity` SELECT policy already exists and would do the scoping for free).

### 1.4 Workspace settings PATCH is broken — `workspaces` has no UPDATE policy

`app/api/workspaces/[id]/route.ts:44-49` updates `workspaces` through the
**RLS client**, but the live database has exactly one policy on `workspaces`
("Members can read workspace", SELECT-only — verified via `pg_policies`).
Under RLS, the UPDATE matches zero rows, so `.single()` errors and the route
returns 500. The "settings persistence" feature shipped in PR #26 cannot work
against the current schema.

Fix: add a migration with an admin UPDATE policy, e.g.

```sql
create policy "Admins can update workspace" on workspaces
  for update using (
    id in (select workspace_id from members
           where user_id = auth.uid() and role = 'admin')
  );
```

(The route already checks admin, so this also keeps defense-in-depth.)

### 1.5 Mass assignment on doc create/update

- `PUT /api/docs/[id]` (`app/api/docs/[id]/route.ts:39-43`) passes the raw
  request body straight into `.update()`. The TypeScript `Pick<>` on
  `updateDoc` is compile-time only. A member can set `author_type`,
  `agent_id`, `last_reviewed_at` (faking freshness/provenance — the fields the
  trust UI is built on), or `workspace_id` (moving a doc into another
  workspace they belong to, skipping that workspace's review culture).
- `POST /api/docs` (`app/api/docs/route.ts:56`) spreads `...body` into
  `createDoc`; explicit fields override the dangerous ones (`status`,
  `author_type`) but unknown columns still pass through.

Fix: whitelist fields in both routes (`title, type, status, owner_id,
body_json, body_md, frontmatter, space_id`) and treat `last_reviewed_at` as
server-set only (the `/reviewed` endpoint exists for that).

---

## 2. High — product-loop and authorization gaps

### 2.1 Agent API auto-approves on write, contradicting the PRD

`app/api/agent/docs/route.ts:63-73` creates agent docs with
`status: "approved"` + `markReviewed: true`, unconditionally. The PRD P0 spec
says the opposite (`aqli-product-docs.md`): *"POST /api/docs — create doc
(agent-authored, auto-sets status: Draft)"* and *"Docs created by agents land
in Draft … Reviewer can Approve, Request Changes, or Reject."* The product's
one-line pitch is "agents write output, humans review and approve."

The GitHub webhook path got this right — it honors a per-workspace
`auto_approve` policy (`lib/integrations/source/feature-doc.ts:101-103`). The
agent API ignores that policy entirely.

Recommendation: route agent-created docs through the same workspace policy
(default **off** → `draft`/`review`), and have the response message reflect
the actual status. If auto-approve-on-write is a deliberate pivot, update the
PRD and the invite-screen copy — today the code, the PRD, and the UI promises
disagree with each other.

### 2.2 Role semantics are promised but only half-enforced

The invite screen (`app/(auth)/invite/InviteClient.tsx:15-19`) promises:
editor = "approve or request changes", viewer = "cannot write or approve."
RLS enforces viewer read-only for *direct* table writes, but every
service-role route must re-implement the check and currently doesn't
(§1.1, §1.2). There is also no admin surface to **change a member's role or
remove a member** — `members` has only a SELECT-own-row policy and no API
route touches it. For a team product, offboarding is table stakes; today a
removed employee keeps access until their auth account is deleted.

Fix: add `update_member_role` / `remove_member` RPCs (SECURITY DEFINER,
admin-checked, protect the last admin) + UI in Settings → Members.

### 2.3 Agent API returns broken URLs

`queryContext` was fixed in PR #28 to emit `/w/{slug}/docs/{id}`, but the
other three agent endpoints still emit `${APP_URL}/docs/${id}` which 404s:

- `app/api/agent/docs/route.ts:35` (list) and `:98` (create response)
- `app/api/agent/docs/[id]/route.ts:48` (read)
- `app/api/agent/docs/[id]/review/route.ts:35` (`review_url`)

Agents follow these links and paste them into PRs/Slack; broken citations
undermine the "source of truth" story. Fix: resolve the workspace slug once
(the key is workspace-scoped) and build real URLs; consider a slug-less
redirect route (`/docs/[id]` → resolve → redirect) so stored links never rot.

### 2.4 Rate limiting and abuse controls are absent

None of the AI routes (`/api/ai/*` — 6 OpenAI-backed endpoints) or the agent
API have any rate limiting. A leaked or malicious API key, or one enthusiastic
workspace member, can run up the OpenAI bill without bound; `validateApiKey`
also does a DB write per agent request (`lib/api-keys.ts:52-56` — the comment
says "don't block auth on it" but the code `await`s it). Suggested: Cloudflare
rate-limiting rules per key/user as a first pass; debounce `last_used_at`
updates (e.g. only write when >60s stale).

---

## 3. Medium — correctness bugs

### 3.1 Editor: failed saves display "Saved", and pending edits are dropped on exit

`DocEditorClient.tsx:55-70` — `persist()` never checks `res.ok`; a 4xx/5xx
(session expired, RLS denial, offline) still sets `lastSaved`, so the user
sees "Saved just now" while their work silently isn't. And the 2s-debounced
timer is not flushed on unmount/navigation (`:86-89`), so the last edit burst
is lost when the user clicks away quickly. Fix: check `res.ok` and surface a
"Couldn't save — retrying" state; flush the pending save in a cleanup handler
and add a `beforeunload` guard while dirty.

### 3.2 Chunker has no size cap → embedding calls can fail after doc creation

`lib/ai/chunker.ts:8-12` claims "Max ~400 words per chunk" but nothing
enforces it — a doc with no `##`/`###` headings becomes a single chunk. Past
~8k tokens the embeddings call throws; on the agent-create path `embedDoc` is
`await`ed unhandled (`app/api/agent/docs/route.ts:88-90`), so the client gets
a 500 *after* the doc was created and will likely retry, creating duplicates.
Fix: split oversized sections (word-count cap with overlap), and make the
create route treat embedding failure as non-fatal (log + return 201, like the
PUT route already does).

### 3.3 `embedDoc` delete-then-insert isn't atomic

`lib/ai/embedder.ts:54-57` — if the insert fails after the delete, the doc
vanishes from agent context until the next save. Two concurrent saves can
also interleave delete/insert. Wrap in an RPC (transaction), or insert new
rows with a generation marker and delete stale ones after.

### 3.4 Agent list pagination is wrong

`app/api/agent/docs/route.ts:36-38` — `total: docs.length` is the *page*
length, not the total; `has_more: docs.length === limit` is false-positive on
exact multiples and the loop consumer will fetch one empty extra page (fine)
but `total` is simply misleading. Also `limit`/`offset` are unvalidated:
`?limit=abc` → `range(NaN, NaN)` → 500; `?limit=100000` is accepted. Use the
Supabase `count: "exact"` option, clamp limit to e.g. 1–100, default on NaN.

### 3.5 Wrong status codes from `.single()` throws

`getDoc()` throws PGRST116 when a doc is missing *or* RLS-invisible, and
routes don't catch it — so `/api/docs/[id]` GET/PUT, `/api/ai/summary`, etc.
return 500 where 404 is correct (`app/api/docs/[id]/route.ts:26`,
`app/api/ai/summary/route.ts:21`). Cosmetic but noisy in logs and confusing
for clients; catch and map to 404.

### 3.6 `getReviewCount` leaks cross-workspace counts

`lib/supabase/review.ts:22-31` uses the service client with a caller-supplied
workspace id (`/api/review?workspace_id=…`). Only a number leaks, but there's
no reason for this to bypass RLS — the sibling `getPendingReviewDocs` right
above it uses the RLS client. Switch it over.

### 3.7 Invitation accept is token-bound, not email-bound

`accept_invitation` (verified in the live DB) checks token/status/expiry but
never compares `auth.email()` to `invitations.email`. Anyone who obtains the
link joins as the invited role. Acceptable as a beta capability-URL model,
but it contradicts the email-addressed UX; either enforce the email match or
consciously document the link-is-the-credential model. Related advisor
finding: `create_workspace_for_user` is executable by `anon` — revoke that
grant (`invitation_details` legitimately needs anon; the others don't).

### 3.8 Supabase advisor findings (live project)

- `docs_update_search_vector` and `search_doc_chunks` have mutable
  `search_path` — set `SET search_path = public` like `accept_invitation` does.
- `vector` extension installed in `public` schema.
- Leaked-password protection (HaveIBeenPwned) is disabled in Auth settings.
- `integration_webhook_events` has RLS enabled with no policies — correct for
  a service-only table, but add a comment/migration note so nobody "fixes" it.

---

## 4. Low — polish and hygiene

- **Middleware runs Supabase auth on machine endpoints** — `/api/agent/*` and
  `/api/integrations/composio/webhook` use Bearer/HMAC auth, yet
  `middleware.ts:66-74` still refreshes cookie sessions on them (wasted
  latency on every agent call, and the webhook is latency-sensitive). Exclude
  them in the matcher.
- **Webhook logs full payloads** — `app/api/integrations/composio/webhook/route.ts:14`
  logs 600 chars of every delivery (PR titles/bodies) to production logs.
  Trim to ids/slugs.
- **`normalizeMarkdownForComparison`/`.or()` filter** — `findMatchingDoc`
  interpolates the Linear key into a PostgREST `.or()` string
  (`lib/integrations/source/feature-doc.ts:281-288`). The regex-extracted key
  is safe today; add a `^[A-Z]+-\d+$` assertion so it stays safe.
- **PostHog `distinctId: "system"`** for webhook events groups all workspaces
  under one identity — use the workspace id for per-tenant analytics.
- **Heading anchors** — `queryContext` builds `#heading-slug` anchors
  (`lib/ai/context.ts:70-72`) but the doc viewer must generate matching ids
  for them to scroll; verify `DocBody` does (otherwise the fragment is dead).
- **`components/editor/v2/types.ts` KeyHandler ordering** — handlers iterate a
  `Set`, so priority is insertion-order-dependent between SlashMenu and
  SelectionToolbar; fine today, fragile tomorrow.
- **`.claude/launch.json` / design handoff artifacts** — `aqli_Design_Handoff/`
  (14 JSX files) ships in the repo; fine for now, but move to a `design/`
  branch or LFS before the OSS release to keep clone size and licensing clean.

---

## 5. Documentation & repo hygiene

1. **The core schema is not in the repo.** `supabase/migrations/` starts at
   `20260608` (integration tables). The Week 1–3 schema — `workspaces`,
   `spaces`, `docs`, `doc_versions`, `doc_chunks`, `doc_comments`,
   `doc_activity`, `api_keys`, `members`, all RLS policies, and the four RPCs —
   exists only in the live project. Even with self-hosting descoped
   (hosted-only as of July 2026), this means no dev/staging environment can be
   stood up and there is no disaster-recovery path for the schema. Run
   `supabase db pull` and commit the baseline migration.
2. **CLAUDE.md is two product-phases stale.** It still says "no agent API,
   RAG, embeddings, or AI features yet (those are Week 2)" and "service-role
   client … unused in Week 1". Any agent session starting from CLAUDE.md gets
   an actively wrong map. Rewrite it against the current architecture
   (agent API, AI routes, Composio pipeline, Cloudflare deployment).
3. **`.env.example` is missing vars the code reads**: `OPENAI_MODEL`
   (`lib/integrations/source/ai.ts:22`), PostHog keys
   (`instrumentation-client.ts` / `lib/posthog-server.ts`).
4. **Test coverage is 2 files** (markdown links, PR parsing) — good choices,
   but zero coverage of the authz layer where every issue in §1 lives. A
   small route-test harness (mock Supabase, assert 401/403/404 per role)
   would have caught all five critical findings and will keep catching them.

---

## 6. Product review — is the built thing the product in the PRD?

**What's genuinely strong:**
- The GitHub→doc pipeline (webhook → verify → dedupe → enrich → LLM summary →
  match-or-create → policy-gated approve) is the most differentiated thing in
  the codebase, and its engineering quality (idempotency claims, merge
  dedupe, graceful LLM fallback) is above the bar for the rest of the app.
- Provenance UI (trust line, provenance bar, what-changed banner,
  auto-approved chip gated on real status) matches the "trust layer" pitch.
- The RAG layer is real and workspace-scoped end to end.

**Where product and code have drifted:**
- **The review loop is the product, and it's off by default.** Agent API
  writes auto-approve unconditionally (§2.1); GitHub auto-approve defaults to
  ON. A new workspace will never see the review queue do anything. For a
  beta whose pitch is "humans approve what agents write," default the trust
  policy to *review* and let teams earn their way to auto-approve — that also
  makes the (nicely built) queue UI visible in demos.
- **P0 gaps still open**: templates per doc type exist, but bulk
  Markdown/Notion import doesn't; filters (owner/tag) are missing from search.
  Either build them or formally descope in the PRD — right now the PRD reads
  as commitments. (Self-host was one of these gaps; it has since been
  formally descoped — the PRD now documents Aqli as hosted-only.)
- **Invitations without email delivery** — invites exist only as copy-paste
  links, and the ops blocker (Supabase confirm-email ON with no SMTP) is
  already tracked in `IMPLEMENTATION.md` §6. This is the single biggest
  activation blocker for real teams; resolve before any beta invite goes out.
- **Success metrics aren't measurable yet.** The PRD defines leading metrics
  (docs created per workspace, % agent-authored, context queries/day).
  PostHog events exist for some (`ai_question_asked`,
  `webhook_doc_generated`) but nothing captures agent context queries or
  review latency — the two numbers that prove the loop works. Add capture on
  `/api/agent/context` and on review actions.
- **API keys are all-or-nothing.** One key = full read/write on the whole
  workspace, forever (no expiry, no scopes, no per-agent identity beyond a
  self-reported `agent_id` string). Post-beta: scoped keys (read-only vs
  write), expiry, and server-assigned agent identity — the audit trail
  currently trusts the writer to name itself.

**Suggested order of work:**
1. §1.1–1.5 (one focused security PR — all five are small diffs).
2. Ops blockers (SMTP/confirm-email, wrangler secrets) — already tracked.
3. §2.1 trust-loop default + §2.3 agent URLs (agent-facing correctness).
4. Commit the baseline schema migration + CLAUDE.md rewrite (§5.1–5.2).
5. §3 correctness items, starting with editor save integrity (3.1).
6. Member management (role change/removal) before inviting real teams.
