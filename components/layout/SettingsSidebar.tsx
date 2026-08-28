"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { setMobileNav, useMobileNav } from "./mobile-nav";
import {
  IconDownload,
  IconGear,
  IconPulse,
  IconKey,
  IconLink,
  IconChevLeft,
  IconFolder,
  IconRobot,
  IconUsers,
} from "@/components/aqli/icons";
import AccountMenu from "./AccountMenu";

type Props = {
  base: string;
  workspaceName: string;
  userName?: string;
  roleLabel?: string;
  isAdmin?: boolean;
};

export default function SettingsSidebar({ base, workspaceName, userName = "You", roleLabel = "Member", isAdmin = false }: Props) {
  const pathname = usePathname();
  const settingsBase = `${base}/settings`;
  const workspaceSlug = base.split("/").filter(Boolean).at(1) ?? "";

  const agentLogHref = `/w/${workspaceSlug}/agent-log`;

  const nav = [
    { id: "general", href: settingsBase, icon: <IconGear />, label: "Workspace", exact: true },
    { id: "spaces", href: `${settingsBase}/spaces`, icon: <IconFolder />, label: "Spaces" },
    { id: "keys", href: `${settingsBase}/keys`, icon: <IconKey />, label: "API keys" },
    { id: "members", href: `${settingsBase}/members`, icon: <IconUsers />, label: "Members" },
    { id: "integrations", href: `${settingsBase}/integrations`, icon: <IconLink />, label: "Integrations" },
    // Admins only: the page reports migrations, RLS state and row counts for
    // the whole installation, and the RPC behind it refuses anyone else.
    ...(isAdmin
      ? [
          { id: "import", href: `${settingsBase}/import`, icon: <IconDownload />, label: "Import" },
          { id: "health", href: `${settingsBase}/health`, icon: <IconPulse />, label: "Health" },
        ]
      : []),
    // Same destination and same name as the workspace sidebar's entry, so the
    // two navigations do not disagree about what the screen is called.
    { id: "agents", href: agentLogHref, icon: <IconRobot />, label: "AI activity" },
  ];

  const navOpen = useMobileNav();
  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  return (
    <>
      <div
        className="sb-scrim"
        data-open={navOpen ? "" : undefined}
        onClick={() => setMobileNav(false)}
        aria-hidden="true"
      />
      <aside className="sb" data-open={navOpen ? "" : undefined} style={{ paddingTop: 14 }}>
      <div style={{ padding: "0 16px 12px" }}>
        <Link
          href={base}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12.5, padding: "6px 8px 6px 4px", margin: "0 -4px 8px", borderRadius: 6, textDecoration: "none" }}
        >
          <IconChevLeft size={14} />
          <span>{workspaceName}</span>
        </Link>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Settings
        </div>
      </div>

      <div className="sb-nav">
        {nav.map((n) => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link key={n.id} href={n.href} className={`sb-item ${active ? "is-active" : ""}`}>
              <span className="sb-icon">{n.icon}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
            </Link>
          );
        })}
      </div>

      <AccountMenu
        base={base}
        userName={userName}
        workspaceSlug={workspaceSlug}
        roleLabel={roleLabel}
      />
      </aside>
    </>
  );
}
