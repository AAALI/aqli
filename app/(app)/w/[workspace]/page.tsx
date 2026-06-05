import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getDocs } from "@/lib/supabase/docs";
import DocList from "@/components/docs/DocList";

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  const docs = await getDocs(workspace.id, { limit: 20 });

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="mb-1 text-xl font-semibold">{workspace.name}</h1>
      <p className="mb-6 text-sm text-neutral-500">Recently updated docs</p>
      <DocList
        docs={docs}
        workspaceSlug={workspace.slug}
        emptyLabel="No docs yet. Open a space and create your first doc."
      />
    </div>
  );
}
