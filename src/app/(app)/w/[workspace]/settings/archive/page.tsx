import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppTopBar from "@/components/layout/AppTopBar";
import { RestoreButton, DeleteForeverButton } from "@/components/docs/DocLifecycle";
import { IconFile } from "@/components/aqli/icons";
import { formatRelative } from "@/lib/utils";

type ArchivedRow = {
  id: string;
  title: string;
  owner_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  parent_doc_id: string | null;
  space: { name: string; slug: string } | null;
};

/**
 * Settings → Archive: every page that has been put away.
 *
 * Archived pages are out of the tree, search, Home and agent context, so this
 * is the one place they can be found again. Editors can restore; the owner of
 * a page or an admin can delete it for good. Everything that happens here is
 * in the audit log.
 */
export default async function SettingsArchivePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const supabase = await createServerSupabaseClient();

  const [role, owners, { data: { user } }, { data }] = await Promise.all([
    getMyRole(workspace.id),
    getOwnerDirectory(workspace.id),
    supabase.auth.getUser(),
    supabase
      .from("docs")
      .select("id, title, owner_id, archived_at, archived_by, parent_doc_id, space:spaces(name, slug)")
      .eq("workspace_id", workspace.id)
      .eq("status", "archived")
      .order("archived_at", { ascending: false, nullsFirst: false })
      .limit(300),
  ]);
  const rows = (data ?? []) as unknown as ArchivedRow[];
  const canRestore = role === "admin" || role === "editor";
  const nameOf = (id: string | null) =>
    id ? (id === user?.id ? "you" : (owners[id]?.name ?? "a teammate")) : null;

  // A page archived with its parent is restored with it; listing it on its
  // own as well would offer a restore that tears the subtree apart.
  const archivedIds = new Set(rows.map((r) => r.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const top = rows.filter((r) => {
    const parent = r.parent_doc_id ? byId.get(r.parent_doc_id) : undefined;
    return !(parent && archivedIds.has(parent.id) && parent.archived_at === r.archived_at);
  });
  const underCount = (id: string) => {
    let n = 0;
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      const at = byId.get(cur)?.archived_at;
      for (const r of rows) {
        if (r.parent_doc_id === cur && r.archived_at === at) {
          n++;
          stack.push(r.id);
        }
      }
    }
    return n;
  };

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Archive" }]} />
      <div className="wrap">
        <div style={{ maxWidth: 820 }}>
          <h1 className="h1">{top.length === 0 ? "Nothing archived." : "Archive"}</h1>
          <p className="h1s">
            Pages put away. They are out of the tree, search and agent context, and nothing in them is lost until
            someone deletes them here.
          </p>

          {top.length > 0 && (
            <section className="sect">
              {top.map((d) => {
                const under = underCount(d.id);
                const canDelete = role === "admin" || d.owner_id === user?.id;
                return (
                  <Link key={d.id} href={`${base}/docs/${d.id}`} className="row">
                    <span style={{ color: "var(--text-secondary)", display: "flex" }}>
                      <IconFile size={16} />
                    </span>
                    <span>
                      <span className="t">{d.title || "Untitled"}</span>
                      <span className="m">
                        {d.space?.name ?? "No space"}
                        {under > 0 ? ` · with ${under} page${under === 1 ? "" : "s"} under it` : ""}
                        {" · archived"}
                        {d.archived_by ? ` by ${nameOf(d.archived_by)}` : ""}
                        {d.archived_at ? ` ${formatRelative(d.archived_at)}` : ""}
                      </span>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {canDelete && <DeleteForeverButton docId={d.id} />}
                      {canRestore && <RestoreButton docId={d.id} />}
                    </span>
                  </Link>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
