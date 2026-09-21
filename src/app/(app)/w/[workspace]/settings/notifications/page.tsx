import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import AppTopBar from "@/components/layout/AppTopBar";
import WebhooksClient from "../WebhooksClient";

/**
 * Settings · Notifications: where the workspace tells other tools what
 * happened — a doc waiting on someone, a mention, a change merged. Moved out
 * from under General, where it sat below the workspace name.
 */
export default async function NotificationsSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const role = await getMyRole(workspace.id);
  const base = `/w/${workspace.slug}`;
  return (
    <>
      <AppTopBar crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Notifications" }]} />
      <div className="wrap">
        <div style={{ maxWidth: 700 }}>
          <h1 className="h1">Notifications</h1>
          <p className="h1s">Send what happens here to Slack or anywhere that takes a webhook.</p>
          <div style={{ marginTop: 22 }}>
            <WebhooksClient workspaceId={workspace.id} isAdmin={role === "admin"} />
          </div>
        </div>
      </div>
    </>
  );
}
