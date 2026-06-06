// Mock data for the Week-2 review surfaces (queue + detail). No backend yet —
// the design is wired with representative sample data keyed by review id.

export type ReviewCard = {
  id: string;
  title: string;
  type: string;
  agent: string;
  body: string;
  foot: string;
  diff: { added: number; removed: number; files: number } | null;
};

export const REVIEW_CARDS: ReviewCard[] = [
  {
    id: "r1",
    title: "Fix: Payout retry on transient bank failures",
    type: "Fix Note",
    agent: "Claude Code",
    body: "Added exponential backoff to payout transfers when the receiving bank returns a 5xx response. Previously, a single transient failure marked the payout as failed and required manual intervention from Host Support. This change retries up to 3 times over 90 minutes before escalating, and emits a `payout.retry_exhausted` event for downstream alerting.",
    foot: "1 hour ago · Triggered by PR #2418 · AIR-2398",
    diff: { added: 47, removed: 8, files: 3 },
  },
  {
    id: "r2",
    title: "Architecture: Reservation cache for hot listings",
    type: "ADR",
    agent: "Cursor Agent",
    body: "Proposes adding a Redis cache layer for high-demand listings during peak booking windows. The current approach causes elevated p95 latency on the reservation detail endpoint for listings with more than 100 nightly searches. Redis would cache 30-second windows of availability with pub/sub invalidation on price or calendar changes.",
    foot: "3 hours ago · No linked issue",
    diff: null,
  },
  {
    id: "r3",
    title: "Fix: Smart Pricing nightly recompute timeout",
    type: "Fix Note",
    agent: "Claude Code",
    body: "Extended the Smart Pricing nightly recompute job timeout from 30 minutes to 90 minutes. The job had been failing intermittently for hosts with 50+ listings since the supply expansion in Q1. Includes a feature flag for staged rollout and a Datadog monitor on job duration p99.",
    foot: "Yesterday · PR #2401 · AIR-2375",
    diff: { added: 22, removed: 14, files: 2 },
  },
];

export type ReviewSection =
  | { h: string; kind: "p"; body: string }
  | { h: string; kind: "ul"; body: string[] };

export type ReviewDoc = {
  id: string;
  title: string;
  type: string;
  status: string;
  agent: { name: string; instance: string };
  submittedAt: string;
  diff: { added: number; removed: number; files: number; isNew: boolean };
  body: ReviewSection[];
};

const PAYOUT_DOC: ReviewDoc = {
  id: "r1",
  title: "Fix: Payout retry on transient bank failures",
  type: "FIX",
  status: "Review",
  agent: { name: "Claude Code", instance: "Ali's laptop" },
  submittedAt: "1 hour ago",
  diff: { added: 124, removed: 0, files: 1, isNew: true },
  body: [
    { h: "What broke", kind: "p", body: "Between 02:14 and 02:31 GST on Jun 4, eleven payouts to NBD, FAB, and Emirates NBD failed with transient bank-side 5xx responses. Our retry policy only fired on HTTP 408 timeouts, so the eleven payouts dropped to FAILED and surfaced to hosts as bounced." },
    { h: "Root cause", kind: "p", body: "The retry decorator in `payouts/retry.py` matched on a hardcoded set of error codes that excluded 502, 503, and 504 — the codes the three banks actually return during their nightly maintenance window." },
    { h: "The fix", kind: "ul", body: [
      "Retry on any 5xx that isn't 501, with exponential backoff (3s → 12s → 48s, capped at 5 attempts)",
      "Add a structured log entry per retry, tagged with bank, attempt number, and error code",
      "Surface a `payout.retry.exhausted` metric so we alert before the host sees a failure",
    ] },
    { h: "Verification", kind: "p", body: "Backfilled the eleven affected payouts manually through the admin tool, all settled by Jun 5 09:00 GST. Synthetic test runs against the bank sandbox confirm the new retry policy fires correctly on 502/503/504." },
    { h: "Follow-ups", kind: "ul", body: [
      "Add the same retry policy to the refund pipeline (separate PR)",
      "Document the bank maintenance windows in the Payout Schedule PRD",
    ] },
  ],
};

const RESERVATION_DOC: ReviewDoc = {
  id: "r2",
  title: "Sticky-host routing for reservations",
  type: "ADR",
  status: "Review",
  agent: { name: "Cursor Agent", instance: "CI runner" },
  submittedAt: "3 hours ago",
  diff: { added: 86, removed: 12, files: 2, isNew: false },
  body: [
    { h: "Context", kind: "p", body: "Reservation detail p95 latency spikes during peak booking windows for hot listings. The stateless read path re-hydrates availability from Postgres on every request, and the cache miss rate climbs above 60% during surges." },
    { h: "Decision", kind: "ul", body: [
      "Introduce a Redis cache layer keyed by listing id, holding 30-second availability windows",
      "Invalidate via pub/sub on price or calendar mutations",
      "Route requests for a given listing to a sticky host to maximise local cache warmth",
    ] },
    { h: "Consequences", kind: "p", body: "Adds a Redis dependency to the reservation read path and a small amount of routing complexity. Expected to cut p95 from 480ms to under 120ms for hot listings, at the cost of up to 30s of availability staleness." },
  ],
};

const REVIEW_DOCS: Record<string, ReviewDoc> = {
  r1: PAYOUT_DOC,
  r2: RESERVATION_DOC,
  r3: { ...PAYOUT_DOC, id: "r3", title: "Fix: Smart Pricing nightly recompute timeout", submittedAt: "Yesterday" },
};

export function getReviewDoc(id: string): ReviewDoc | null {
  return REVIEW_DOCS[id] ?? null;
}

export type AgentTrailEntry = { title: string; type: string; space: string; note: string };

export const AGENT_TRAIL: AgentTrailEntry[] = [
  { title: "Host Payout Schedule", type: "PRD", space: "Product", note: "Read full doc · v4" },
  { title: "Bank API Runbook", type: "RUN", space: "Engineering", note: "Read §3 Retry policy" },
  { title: "T&S Hold Rule 4.2 — Payout Holds", type: "POL", space: "Trust & Safety", note: "Read §c" },
  { title: "Fix: Identity Verification Status Sync", type: "FIX", space: "Engineering", note: "Read as prior-art" },
];

export type ReviewComment = {
  who: { name: string; initial: string; cls: string };
  when: string;
  body: string;
  anchor: string;
};

export const REVIEW_COMMENTS: ReviewComment[] = [
  {
    who: { name: "Sara", initial: "S", cls: "avatar-sara" },
    when: "4 minutes ago",
    body: "Backoff curve looks right but can we double-check the jitter range? Bank API guidelines say 250–750ms not 0–500.",
    anchor: "The fix",
  },
];
