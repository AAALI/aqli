import { notFound } from "next/navigation";
import { getDoc } from "@/lib/supabase/docs";
import { getSpaces } from "@/lib/supabase/spaces";
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

  const [spaces, members, supabase] = await Promise.all([
    getSpaces(doc.workspace_id),
    // Non-fatal: the publish sheet simply drops its checker row if this fails.
    listWorkspaceMembers(doc.workspace_id).catch(() => []),
    createServerSupabaseClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Who can be asked to check something: everyone who could act on it, minus
  // yourself. Asking yourself to confirm your own doc is what publishing with
  // nobody selected already means.
  const people = members
    .filter((m) => m.role === "admin" || m.role === "editor")
    .filter((m) => m.user_id !== user?.id)
    .map((m) => ({ id: m.user_id, name: ownerInfo(m).name }));

  return (
    <DocEditorClientLoader
      doc={doc}
      workspaceSlug={wsSlug}
      spaces={spaces}
      people={people}
    />
  );
}
