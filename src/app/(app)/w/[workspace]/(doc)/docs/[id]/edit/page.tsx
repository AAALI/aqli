import { notFound } from "next/navigation";
import { getDoc, getDocVersions } from "@/lib/supabase/docs";
import { listWorkspaceMembers } from "@/lib/supabase/members";
import { ownerInfo } from "@/lib/supabase/owners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import DocEditorClientLoader from "./DocEditorClientLoader";

export default async function DocEditPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();

  const [versions, members, supabase] = await Promise.all([
    getDocVersions(id),
    // Non-fatal: the strip just drops the "will notify" clause if this fails.
    listWorkspaceMembers(doc.workspace_id).catch(() => []),
    createServerSupabaseClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ownerName =
    doc.owner_id && user?.id === doc.owner_id
      ? ((user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "You")
      : doc.owner_id
        ? "Team member"
        : null;

  // Who a review request actually reaches: everyone who can act on the queue.
  // Viewers can't, and telling the author they will notify themselves is noise.
  const reviewers = members
    .filter((m) => m.role === "admin" || m.role === "editor")
    .filter((m) => m.user_id !== user?.id)
    .map((m) => ownerInfo(m).name);

  return (
    <DocEditorClientLoader
      doc={doc}
      workspaceSlug={wsSlug}
      version={versions.length || 1}
      ownerName={ownerName}
      reviewers={reviewers}
    />
  );
}
