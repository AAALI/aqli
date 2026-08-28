import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import AppTopBar from "@/components/layout/AppTopBar";
import { buildChecks, overall, readAuthSettings, EXPECTED_MIGRATION_VERSIONS } from "@/lib/preflight";
import type { Check, DbReport } from "@/lib/preflight";

/**
 * Settings → Health: the same report `pnpm preflight` prints, for the admin
 * who deployed this from a template and has no shell to run it in.
 *
 * Server-rendered with no client component on purpose. It is a page you read
 * and act on, refreshing re-runs every check, and the worker has a hard bundle
 * ceiling that a stateless list of findings has no business spending.
 */
export const dynamic = "force-dynamic";

const TONE: Record<Check["status"], { fg: string; bg: string; label: string }> = {
  ok: { fg: "var(--ok-fg, #15803d)", bg: "var(--ok-bg, #dcfce7)", label: "OK" },
  warn: { fg: "var(--warn-fg, #a16207)", bg: "var(--warn-bg, #fef9c3)", label: "Check" },
  fail: { fg: "var(--danger-fg, #b91c1c)", bg: "var(--danger-bg, #fee2e2)", label: "Fix" },
};

export default async function SettingsHealthPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const role = await getMyRole(workspace.id);

  // The report names every table, gate and count in the installation. The RPC
  // refuses a non-admin as well; this is so the page does not exist for them.
  if (role !== "admin") notFound();

  const base = `/w/${workspace.slug}`;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("preflight_report", {
    p_expected_migrations: EXPECTED_MIGRATION_VERSIONS,
  });

  const auth = await readAuthSettings(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const checks = buildChecks({
    db: (data as DbReport | null) ?? null,
    dbError: error?.message,
    env: process.env as Record<string, string | undefined>,
    auth,
    production: process.env.NODE_ENV === "production",
  });

  const status = overall(checks);
  const headline =
    status === "ok"
      ? "Everything the code expects is in place."
      : status === "warn"
        ? "Usable, with the notes below."
        : "Something here needs fixing before you invite anyone.";

  return (
    <>
      <AppTopBar
        base={base}
        crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Health" }]}
      />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Health</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 4 }}>{headline}</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12.5, marginBottom: 24 }}>
            The same checks <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>pnpm preflight</code>{" "}
            runs. Refresh to run them again.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {checks.map((check) => {
              const tone = TONE[check.status];
              return (
                <div
                  key={check.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "12px 14px",
                    background: "var(--bg-card)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: check.status === "ok" ? 0 : 6 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: tone.fg,
                        background: tone.bg,
                        padding: "2px 7px",
                        borderRadius: 999,
                      }}
                    >
                      {tone.label}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{check.title}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{check.detail}</div>
                  {check.fix && check.status !== "ok" && (
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                      {check.fix}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
