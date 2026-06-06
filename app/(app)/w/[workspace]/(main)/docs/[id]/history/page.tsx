import { notFound } from "next/navigation";
import { getDoc, getDocVersions } from "@/lib/supabase/docs";
import HistoryClient from "./HistoryClient";

export default async function DocHistoryPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();
  const versions = await getDocVersions(id);

  return (
    <HistoryClient
      workspaceSlug={wsSlug}
      docId={doc.id}
      docTitle={doc.title}
      spaceName={doc.space?.name ?? null}
      spaceSlug={doc.space?.slug ?? null}
      versions={versions.map((v) => ({
        id: v.id,
        version_number: v.version_number,
        change_type: v.change_type,
        created_at: v.created_at,
        body_md: v.body_md ?? "",
      }))}
    />
  );
}
