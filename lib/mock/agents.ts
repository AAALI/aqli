// Mock data for Week-2 surfaces (review queue, notifications, integrations,
// settings, stale dashboard, agent activity). These features have no backend
// yet — the design is wired with representative sample data.

export type Notif = {
  id: string;
  kind: "review" | "approval" | "mention" | "stale";
  unread: boolean;
  tint: "agent" | "ok" | "review" | "stale";
  actor: string;
  body: string;
  target: string;
  space: string;
  when: string;
  primary?: boolean;
  href?: string;
};

export const NOTIFS: Notif[] = [
  {
    id: "n1",
    kind: "review",
    unread: true,
    tint: "agent",
    actor: "Claude Code",
    body: "submitted a Fix Note for review",
    target: "Fix: Payout retry on transient bank failures",
    space: "Engineering",
    when: "1 hour ago",
    primary: true,
    href: "review/r1",
  },
  {
    id: "n2",
    kind: "approval",
    unread: true,
    tint: "ok",
    actor: "Sara",
    body: "approved your PRD",
    target: "AED Withdrawal Flow",
    space: "Product",
    when: "3 hours ago",
  },
  {
    id: "n3",
    kind: "mention",
    unread: true,
    tint: "review",
    actor: "Khalid",
    body: "mentioned you in",
    target: "WebSocket Connection Pooling",
    space: "Engineering",
    when: "5 hours ago",
  },
  {
    id: "n4",
    kind: "stale",
    unread: false,
    tint: "stale",
    actor: "Aqli",
    body: "flagged stale",
    target: "Search Ranking Service Runbook",
    space: "Engineering",
    when: "Yesterday",
  },
  {
    id: "n5",
    kind: "review",
    unread: false,
    tint: "agent",
    actor: "Cursor",
    body: "submitted an ADR for review",
    target: "Sticky-host routing for reservations",
    space: "Engineering",
    when: "Yesterday",
    href: "review/r2",
  },
];

export type ReviewItem = {
  id: string;
  title: string;
  type: string;
  space: string;
  agent: string;
  instance: string;
  submitted: string;
  added: number;
  removed: number;
  isNew: boolean;
};

export const REVIEW_QUEUE: ReviewItem[] = [
  {
    id: "r1",
    title: "Fix: Payout retry on transient bank failures",
    type: "Fix Note",
    space: "Engineering",
    agent: "Claude Code",
    instance: "Ali's laptop",
    submitted: "1 hour ago",
    added: 124,
    removed: 0,
    isNew: true,
  },
  {
    id: "r2",
    title: "Sticky-host routing for reservations",
    type: "ADR",
    space: "Engineering",
    agent: "Cursor",
    instance: "CI runner",
    submitted: "Yesterday",
    added: 86,
    removed: 12,
    isNew: false,
  },
  {
    id: "r3",
    title: "Refund pipeline retry policy",
    type: "Fix Note",
    space: "Engineering",
    agent: "Claude Code",
    instance: "Ali's laptop",
    submitted: "2 days ago",
    added: 54,
    removed: 4,
    isNew: false,
  },
];
