import { notFound } from "next/navigation";
import { getDoc } from "@/lib/supabase/docs";
import DocEditorClient from "./DocEditorClient";

export default async function DocEditPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();

  return <DocEditorClient doc={doc} workspaceSlug={wsSlug} />;
}
