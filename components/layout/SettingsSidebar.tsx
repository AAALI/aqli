"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGear,
  IconUsers,
  IconKey,
  IconLink,
  IconRobot,
  IconBell,
  IconChevLeft,
  IconShare,
} from "@/components/aqli/icons";

type Props = {
  base: string;
  workspaceName: string;
  userName?: string;
};

export default function SettingsSidebar({ base, workspaceName, userName = "You" }: Props) {
  const pathname = usePathname();
  const settingsBase = `${base}/settings`;
  const initial = userName.trim().charAt(0).toUpperCase() || "Y";

  const nav = [
    { id: "general", href: settingsBase, icon: <IconGear />, label: "Workspace", exact: true },
    { id: "members", href: `${settingsBase}/members`, icon: <IconUsers />, label: "Members", count: 4 },
    { id: "keys", href: `${settingsBase}/keys`, icon: <IconKey />, label: "API keys", count: 3 },
    { id: "integrations", href: `${settingsBase}/integrations`, icon: <IconLink />, label: "Integrations" },
    { id: "notifications", href: `${settingsBase}/notifications`, icon: <IconBell />, label: "Notifications" },
    { id: "agents", href: `${settingsBase}/agents`, icon: <IconRobot />, label: "Agent activity" },
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
              {n.count != null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{n.count}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: 20, padding: "0 8px" }}>
        <div className="sb-section-label" style={{ paddingLeft: 10 }}>Danger zone</div>
        <div className="sb-item" style={{ color: "#993C1D" }}>
          <span className="sb-icon" style={{ color: "#993C1D" }}><IconShare /></span>
          <span>Delete workspace</span>
        </div>
      </div>

      <div className="sb-foot" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="avatar avatar-ali" style={{ width: 28, height: 28 }}>{initial}</span>
        <div className="meta">
          <div className="n">{userName}</div>
          <div className="w">Admin</div>
        </div>
      </div>
    </aside>
  );
}
