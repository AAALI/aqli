"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconChevLeft } from "@/components/aqli/icons";
import { createClient } from "@/lib/supabase/client";

type Props = {
  base: string;
  workspaceName: string;
  isAdmin?: boolean;
};

/**
 * Settings nav (v3 §5.10, frame 10). Admin is findable, not present: a narrow
 * nav reached on purpose, with a way back to the workspace at the top.
 * Three groups — the workspace, what it connects to, and you.
 */
export default function SettingsSidebar({ base, workspaceName, isAdmin = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const s = `${base}/settings`;

  const groups: { label: string; items: { href: string; label: string; exact?: boolean }[] }[] = [
    {
      label: "Workspace",
      items: [
        { href: s, label: "General", exact: true },
        { href: `${s}/members`, label: "People" },
        { href: `${s}/spaces`, label: "Spaces" },
        // Installation-wide reports; the RPCs behind them refuse anyone else.
        ...(isAdmin
          ? [
              { href: `${s}/import`, label: "Import & export" },
              { href: `${s}/health`, label: "Health" },
            ]
          : []),
      ],
    },
    {
      label: "Connections",
      items: [
        { href: `${s}/keys`, label: "AI access" },
        { href: `${s}/integrations`, label: "Integrations" },
        { href: `${s}/notifications`, label: "Notifications" },
      ],
    },
  ];

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <aside className="set-nav sb">
        <Link href={base} className="btn btn-ghost" style={{ marginBottom: 16, padding: "0 8px 0 4px", alignSelf: "flex-start" }}>
          <IconChevLeft size={16} />
          {workspaceName}
        </Link>
        {groups.map((g, i) => (
          <div key={g.label}>
            <div className="sb-section-label" style={{ padding: `${i === 0 ? 6 : 16}px 10px 6px` }}>{g.label}</div>
            {g.items.map((n) => {
              const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={`sb-item ${active ? "is-active" : ""}`} style={{ fontSize: 13 }}>
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="sb-section-label" style={{ padding: "16px 10px 6px" }}>You</div>
        <button type="button" className="sb-item" onClick={signOut} style={{ background: "none", border: 0, width: "100%", textAlign: "left", fontFamily: "inherit", fontSize: 13 }}>
          Sign out
        </button>
      </aside>
    </>
  );
}
