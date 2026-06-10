import { notFound } from "next/navigation";
import { getDoc, getDocVersions } from "@/lib/supabase/docs";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import DocEditorClient from "./DocEditorClient";

export default async function DocEditPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();

  const [versions, supabase] = await Promise.all([
    getDocVersions(id),
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

  return (
    <DocEditorClient
      doc={doc}
      workspaceSlug={wsSlug}
      version={versions.length || 1}
      ownerName={ownerName}
    />
  );
}
