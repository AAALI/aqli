import { createServerSupabaseClient, createServiceClient } from "./server";
import type {
  ActivityAction,
  ActorType,
  DocActivity,
  DocActivityWithDoc,
} from "@/types/activity";

/**
 * Append a row to the doc activity log. Fire-and-forget by design — activity
 * logging must never block or fail the mutation it's recording, so callers
 * typically `await` it but errors are swallowed here rather than thrown.
 * Uses the service-role client so it works from both human and agent paths.
 */
export async function logActivity({
  docId,
  workspaceId,
  actorType,
  actorId,
  actorName,
  action,
  metadata = {},
}: {
  docId: string;
  workspaceId: string;
  actorType: ActorType;
  actorId: string | null;
  actorName: string | null;
  action: ActivityAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("doc_activity").insert({
      doc_id: docId,
      workspace_id: workspaceId,
      actor_type: actorType,
      actor_id: actorId,
      actor_name: actorName,
      action,
      metadata,
    });
    if (error) console.error("logActivity failed:", error.message);
  } catch (err) {
    console.error("logActivity threw:", err);
  }
}

/**
 * Log an `updated` event, but coalesce a burst of edits by the same actor into
 * a single entry. Autosave fires the update route every couple of seconds, so
 * without this the feed would fill with hundreds of identical rows per session.
 * The first edit is logged; subsequent edits within `windowMinutes` are skipped.
 */
export async function logEditCoalesced({
  docId,
  workspaceId,
  actorId,
  actorName,
  windowMinutes = 10,
}: {
  docId: string;
  workspaceId: string;
  actorId: string | null;
  actorName: string | null;
  windowMinutes?: number;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("doc_activity")
      .select("action, actor_id, created_at")
      .eq("doc_id", docId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      data &&
      data.action === "updated" &&
      data.actor_id === actorId &&
      Date.now() - new Date(data.created_at as string).getTime() <
        windowMinutes * 60 * 1000
    ) {
      return; // recent edit by same actor already logged
    }
  } catch (err) {
    console.error("logEditCoalesced lookup failed:", err);
  }

  await logActivity({
    docId,
    workspaceId,
    actorType: "human",
    actorId,
    actorName,
    action: "updated",
  });
}

export async function getDocActivity(
  docId: string,
  limit = 50,
): Promise<DocActivity[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("doc_activity")
    .select("*")
    .eq("doc_id", docId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DocActivity[];
}

export async function getWorkspaceAgentActivity(
  workspaceId: string,
  limit = 100,
): Promise<DocActivityWithDoc[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("doc_activity")
    .select("*, doc:docs(id, title, type, status, space_id)")
    .eq("workspace_id", workspaceId)
    .eq("actor_type", "agent")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DocActivityWithDoc[];
}

/** doc_activity row joined with enough doc context to render the Home feed. */
export type FeedActivity = DocActivity & {
  doc: {
    id: string;
    title: string;
    type: string;
    status: string;
    frontmatter: { source_pr_url?: string; source_repo?: string } | null;
    space: { name: string; slug: string } | null;
  } | null;
};

/**
 * Recent workspace activity for the Home "What's new" feed — every actor, most
 * meaningful actions only (the autosave-noise `updated`/`embedded` rows and
 * routine `reviewed` pings are filtered out).
 */
export async function getWorkspaceActivity(
  workspaceId: string,
  limit = 25,
): Promise<FeedActivity[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("doc_activity")
    .select(
      "*, doc:docs(id, title, type, status, frontmatter, space:spaces(name, slug))",
    )
    .eq("workspace_id", workspaceId)
    .in("action", [
      "created",
      "approved",
      "status_changed",
      "review_requested",
      "changes_requested",
      "rejected",
    ])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FeedActivity[];
}
