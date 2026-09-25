import { headers } from "next/headers";
import { scoped } from "@/lib/db";

/**
 * The workspace audit log (`audit_events`, 20260925000000).
 *
 * `doc_activity` is a per-document feed, and it goes when the document goes.
 * This is the record that stays: who did what to which thing, from where,
 * with a snapshot of the thing's name because it may not exist tomorrow. The
 * table is append-only in the database; this module is the only writer.
 *
 * Recording never throws. An audit write that fails is logged and the action
 * it describes still happens — refusing to delete a page because the log was
 * unreachable would make the log the thing that breaks the product.
 */

export type AuditActor =
  | { type: "human"; userId: string; name?: string | null }
  | {
      type: "agent";
      /** The API key used, when known. */
      keyId?: string | null;
      /** The person accountable for the key. */
      ownerUserId?: string | null;
      name?: string | null;
    }
  | { type: "system"; name: string };

export type AuditTargetType =
  | "doc"
  | "draft"
  | "comment"
  | "space"
  | "member"
  | "invitation"
  | "api_key"
  | "webhook"
  | "workspace"
  | "integration"
  | "import"
  | "export";

/** `<target>.<verb>`. Kept as a union so the log's filters stay honest. */
export type AuditAction =
  | "doc.created"
  | "doc.edited"
  | "doc.published"
  | "doc.status_changed"
  | "doc.moved"
  | "doc.archived"
  | "doc.restored"
  | "doc.deleted"
  | "doc.review_requested"
  | "doc.reviewed"
  | "doc.approved"
  | "doc.rejected"
  | "doc.changes_requested"
  | "doc.commented"
  | "doc.nudged"
  | "draft.discarded"
  | "comment.deleted"
  | "space.created"
  | "space.updated"
  | "space.deleted"
  | "space.member_added"
  | "space.member_removed"
  | "member.role_changed"
  | "member.removed"
  | "invitation.sent"
  | "invitation.revoked"
  | "api_key.created"
  | "api_key.updated"
  | "api_key.revoked"
  | "webhook.created"
  | "webhook.updated"
  | "webhook.deleted"
  | "workspace.updated"
  | "integration.connected"
  | "integration.updated"
  | "import.applied"
  | "export.downloaded";

export type AuditInput = {
  workspaceId: string;
  actor: AuditActor;
  action: AuditAction;
  target: { type: AuditTargetType; id?: string | null; label?: string | null };
  docId?: string | null;
  spaceId?: string | null;
  metadata?: Record<string, unknown>;
};

/** A signed-in person, the way every route has them. */
export function humanActor(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): AuditActor {
  return {
    type: "human",
    userId: user.id,
    name: (user.user_metadata?.full_name as string | undefined) || user.email || null,
  };
}

/** An agent, named by its key so the log reads "Release bot", not a uuid. */
export async function agentActor(
  workspaceId: string,
  keyId: string | null,
  ownerUserId: string | null,
): Promise<AuditActor> {
  let name: string | null = null;
  if (keyId) {
    try {
      const { data } = await scoped(workspaceId).from("api_keys").select("name").eq("id", keyId).maybeSingle();
      name = (data?.name as string | undefined) ?? null;
    } catch {
      // Unnamed is still attributable: the key id is on the row.
    }
  }
  return { type: "agent", keyId, ownerUserId, name };
}

/**
 * Where a request came from. Outside a request (a script, a background job)
 * `headers()` throws, and there is simply no origin to record.
 */
async function origin(): Promise<{ ip: string | null; user_agent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = h.get("cf-connecting-ip") || forwarded || h.get("x-real-ip") || null;
    const ua = h.get("user-agent");
    return { ip, user_agent: ua ? ua.slice(0, 400) : null };
  } catch {
    return { ip: null, user_agent: null };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v: string | null | undefined) => (v && UUID.test(v) ? v : null);

/** The row, without its origin. Exported for the tests. */
export function auditRow(input: AuditInput) {
  const { actor } = input;
  return {
    actor_type: actor.type,
    actor_id:
      actor.type === "human" ? asUuid(actor.userId) : actor.type === "agent" ? asUuid(actor.ownerUserId) : null,
    actor_key_id: actor.type === "agent" ? asUuid(actor.keyId) : null,
    actor_name: actor.name ?? null,
    action: input.action,
    target_type: input.target.type,
    target_id: input.target.id ?? null,
    target_label: input.target.label ?? null,
    doc_id: asUuid(input.docId),
    space_id: asUuid(input.spaceId),
    metadata: input.metadata ?? {},
  };
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const { error } = await scoped(input.workspaceId)
      .from("audit_events")
      .insert({ ...auditRow(input), ...(await origin()) });
    if (error) console.error("recordAudit failed:", error.message);
  } catch (err) {
    console.error("recordAudit threw:", err);
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type AuditEvent = {
  id: string;
  workspace_id: string;
  occurred_at: string;
  actor_type: "human" | "agent" | "system";
  actor_id: string | null;
  actor_key_id: string | null;
  actor_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  doc_id: string | null;
  space_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  source: "app" | "backfill";
};

/** The filter groups on the log page: one chip per kind of thing. */
export const AUDIT_GROUPS: { key: string; label: string; prefixes: string[] }[] = [
  { key: "pages", label: "Pages", prefixes: ["doc.", "draft."] },
  { key: "deletions", label: "Deletions & archive", prefixes: ["doc.deleted", "doc.archived", "doc.restored", "draft.discarded", "comment.deleted", "space.deleted"] },
  { key: "reviews", label: "Reviews", prefixes: ["doc.review_requested", "doc.reviewed", "doc.approved", "doc.rejected", "doc.changes_requested"] },
  { key: "people", label: "People", prefixes: ["member.", "invitation.", "space.member_"] },
  { key: "access", label: "AI access & integrations", prefixes: ["api_key.", "integration.", "webhook."] },
  { key: "workspace", label: "Workspace & spaces", prefixes: ["workspace.", "space.", "import.", "export."] },
];

/** Past tense, lower case: "archived", "changed a role on". */
const VERB: Record<string, string> = {
  "doc.created": "created",
  "doc.edited": "edited",
  "doc.published": "published",
  "doc.status_changed": "changed the status of",
  "doc.moved": "moved",
  "doc.archived": "archived",
  "doc.restored": "restored",
  "doc.deleted": "permanently deleted",
  "doc.review_requested": "asked for a check on",
  "doc.reviewed": "confirmed",
  "doc.approved": "approved",
  "doc.rejected": "declined",
  "doc.changes_requested": "requested changes on",
  "doc.commented": "commented on",
  "doc.nudged": "nudged checkers on",
  "doc.embedded": "indexed",
  "draft.discarded": "discarded the draft",
  "comment.deleted": "deleted a comment on",
  "space.created": "created the space",
  "space.updated": "updated the space",
  "space.deleted": "deleted the space",
  "space.member_added": "gave access to",
  "space.member_removed": "removed access to",
  "member.role_changed": "changed the role of",
  "member.removed": "removed",
  "invitation.sent": "invited",
  "invitation.revoked": "revoked the invitation for",
  "api_key.created": "created the API key",
  "api_key.updated": "changed the rules on the API key",
  "api_key.revoked": "revoked the API key",
  "webhook.created": "added the webhook",
  "webhook.updated": "updated the webhook",
  "webhook.deleted": "removed the webhook",
  "workspace.updated": "updated workspace settings",
  "integration.connected": "connected",
  "integration.updated": "updated the integration",
  "import.applied": "imported",
  "export.downloaded": "exported the workspace",
};

export function auditVerb(action: string): string {
  return VERB[action] ?? action.replace(/^[a-z_]+\./, "").replace(/_/g, " ");
}

export type AuditQuery = {
  group?: string | null;
  actorId?: string | null;
  docId?: string | null;
  q?: string | null;
  before?: string | null;
  limit?: number;
};

/**
 * One page of the log, newest first. Keyset-paginated on `occurred_at` so a
 * busy workspace's log does not get slower the further back you read.
 * Callers gate on admin before calling: this runs on the service role.
 */
export async function listAuditEvents(workspaceId: string, query: AuditQuery = {}) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
  let q = scoped(workspaceId)
    .from("audit_events")
    .select("*")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  // Both filters are ORs across several conditions. PostgREST does not
  // promise to AND two `or` parameters, so two of them are nested in one.
  const ors: string[] = [];
  const group = AUDIT_GROUPS.find((g) => g.key === query.group);
  if (group) {
    ors.push(
      group.prefixes
        .map((p) => (p.endsWith(".") || p.endsWith("_") ? `action.like.${p}*` : `action.eq.${p}`))
        .join(","),
    );
  }
  if (query.q) {
    // PostgREST's `or` grammar reserves these; a title containing one is still
    // found by the words around it.
    const term = query.q.replace(/[,()*%\\:."]/g, " ").trim().slice(0, 100);
    if (term) ors.push(`target_label.ilike.*${term}*,actor_name.ilike.*${term}*`);
  }
  if (ors.length === 1) q = q.or(ors[0]);
  else if (ors.length === 2) q = q.or(`and(or(${ors[0]}),or(${ors[1]}))`);
  if (query.actorId && UUID.test(query.actorId)) q = q.eq("actor_id", query.actorId);
  if (query.docId && UUID.test(query.docId)) q = q.eq("doc_id", query.docId);
  if (query.before && !Number.isNaN(Date.parse(query.before))) q = q.lt("occurred_at", query.before);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as AuditEvent[];
  const more = rows.length > limit;
  const events = more ? rows.slice(0, limit) : rows;
  return { events, next: more ? events[events.length - 1].occurred_at : null };
}

/** A CSV cell, quoted and defused: a cell starting with = + - @ is a formula to a spreadsheet. */
export function csvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  let v = String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}
