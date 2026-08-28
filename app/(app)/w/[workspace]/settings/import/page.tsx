import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import { getSpaces } from "@/lib/supabase/spaces";
import AppTopBar from "@/components/layout/AppTopBar";
import ImportClient from "./ImportClient";

/**
 * Settings → Import.
 *
 * The browser half of the ingest surface. A hosted customer has no shell, so
 * an import they cannot start themselves is one they wait on us for.
 */
export default async function SettingsImportPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const role = await getMyRole(workspace.id);
  if (role !== "admin") notFound();

  const spaces = await getSpaces(workspace.id).catch(() => []);
  const base = `/w/${workspace.slug}`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Import" }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <ImportClient
            workspaceId={workspace.id}
            base={base}
            spaces={spaces.map((s) => ({ id: s.id, name: s.name }))}
          />
        </div>
      </div>
    </>
  );
}
