"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconGear,
  IconKey,
  IconLink,
  IconChevLeft,
  IconRobot,
  IconUsers,
} from "@/components/aqli/icons";
import AccountMenu from "./AccountMenu";

type Props = {
  base: string;
  workspaceName: string;
  userName?: string;
  roleLabel?: string;
};

export default function SettingsSidebar({ base, workspaceName, userName = "You", roleLabel = "Member" }: Props) {
  const pathname = usePathname();
  const settingsBase = `${base}/settings`;
  const workspaceSlug = base.split("/").filter(Boolean).at(1) ?? "";

  const nav = [
    { id: "general", href: settingsBase, icon: <IconGear />, label: "Workspace", exact: true },
    { id: "keys", href: `${settingsBase}/keys`, icon: <IconKey />, label: "API keys" },
    { id: "members", href: `${settingsBase}/members`, icon: <IconUsers />, label: "Members" },
    { id: "integrations", href: `${settingsBase}/integrations`, icon: <IconLink />, label: "Integrations" },
    { id: "agents", href: `${settingsBase}/agents`, icon: <IconRobot />, label: "Agent activity" },
    { id: "notifications", href: `${settingsBase}/notifications`, icon: <IconBell />, label: "Notifications" },
  ];

  return (
    <aside className="sb" style={{ paddingTop: 14 }}>
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
  );
}
