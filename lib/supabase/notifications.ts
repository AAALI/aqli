import { getPendingReviewDocs } from "./review";
import { getStaleDocs } from "./stale";
import { getWorkspaceAgentActivity } from "./activity";
import { getSpaces } from "./spaces";
import { formatRelative } from "@/lib/utils";

export type NotifTint = "agent" | "ok" | "review" | "stale";
export type NotifKind = "review" | "approval" | "agent" | "stale";

export type Notification = {
  id: string;
  kind: NotifKind;
  tint: NotifTint;
  actor: string;
  body: string;
  target: string;
  space: string;
  when: string;
  href: string | null;
  unread: boolean;
  today: boolean;
  primary?: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

const AGENT_VERB: Record<string, { body: string; tint: NotifTint; kind: NotifKind }> = {
  approved: { body: "auto-approved", tint: "ok", kind: "approval" },
  created: { body: "drafted (awaiting review)", tint: "agent", kind: "agent" },
  status_changed: { body: "updated", tint: "agent", kind: "agent" },
  review_requested: { body: "requested review for", tint: "review", kind: "review" },
};

/**
 * The notification feed for the top-bar bell — composed from real signals:
 * docs awaiting review, recent agent activity, and stale docs. Replaces the
 * former `lib/mock/agents` NOTIFS placeholder.
 */
export async function getNotifications(workspaceId: string): Promise<Notification[]> {
  const [reviews, stale, agentActivity, spaces] = await Promise.all([
    getPendingReviewDocs(workspaceId),
    getStaleDocs(workspaceId),
    getWorkspaceAgentActivity(workspaceId, 15),
    getSpaces(workspaceId),
  ]);

  const spaceName = (id: string | null) => spaces.find((s) => s.id === id)?.name ?? "";
  const now = Date.now();
  const rows: (Notification & { ts: number })[] = [];

  for (const d of reviews) {
    const ts = Date.parse(d.updated_at);
    rows.push({
      id: `review-${d.id}`,
      kind: "review",
      tint: "review",
      actor: d.author_type === "agent" ? (d.agent_id ?? "An agent") : "A teammate",
      body: "needs your review",
      target: d.title,
      space: d.space?.name ?? "",
      when: formatRelative(d.updated_at),
      href: `docs/${d.id}`,
      unread: true,
      today: now - ts < DAY,
      ts,
    });
  }

  for (const a of agentActivity) {
    if (!a.doc) continue;
    const v = AGENT_VERB[a.action];
    if (!v) continue;
    const ts = Date.parse(a.created_at);
    rows.push({
      id: `act-${a.id}`,
      kind: v.kind,
      tint: v.tint,
      actor: a.actor_name ?? "An agent",
      body: v.body,
      target: a.doc.title,
      space: spaceName(a.doc.space_id),
      when: formatRelative(a.created_at),
      href: `docs/${a.doc.id}`,
      unread: now - ts < DAY,
      today: now - ts < DAY,
      ts,
    });
  }

  for (const d of stale) {
    const ts = Date.parse(d.last_reviewed_at ?? d.updated_at);
    rows.push({
      id: `stale-${d.id}`,
      kind: "stale",
      tint: "stale",
      actor: "Aqli",
      body: "flagged as past its freshness window —",
      target: d.title,
      space: d.space?.name ?? "",
      when: d.last_reviewed_at ? `verified ${formatRelative(d.last_reviewed_at)}` : "never verified",
      href: `docs/${d.id}`,
      unread: false,
      today: false,
      ts,
    });
  }

  // Most recent first, de-duped by destination + kind, capped.
  rows.sort((a, b) => b.ts - a.ts);
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const key = `${r.kind}:${r.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const top = deduped.slice(0, 12);
  if (top[0]) top[0].primary = true;

  // Drop the internal sort key from the returned shape.
  return top.map((r): Notification => ({
    id: r.id,
    kind: r.kind,
    tint: r.tint,
    actor: r.actor,
    body: r.body,
    target: r.target,
    space: r.space,
    when: r.when,
    href: r.href,
    unread: r.unread,
    today: r.today,
    primary: r.primary,
  }));
}
