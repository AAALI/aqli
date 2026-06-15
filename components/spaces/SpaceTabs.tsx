"use client";

import { useState } from "react";
import { IconBook, IconFile } from "@/components/aqli/icons";

type TabId = "shelves" | "list";

/**
 * Space view switcher. Default is the curated "Shelves" library view; the
 * flat list survives behind the "All docs" tab (the v1 fallback the brief
 * keeps). Both panels are server-rendered and passed in as slots.
 */
export default function SpaceTabs({
  shelves,
  list,
  docCount,
}: {
  shelves: React.ReactNode;
  list: React.ReactNode;
  docCount: number;
}) {
  const [tab, setTab] = useState<TabId>("shelves");

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "shelves", label: "Shelves", icon: <IconBook size={13} /> },
    { id: "list", label: "All docs", icon: <IconFile size={13} />, count: docCount },
  ];

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border)",
          padding: "0 56px",
          background: "var(--bg-base)",
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                marginBottom: -1,
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 7,
                cursor: "pointer",
              }}
            >
              <span style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>{t.icon}</span>
              {t.label}
              {t.count != null && (
                <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "32px 56px 56px" }}>{tab === "shelves" ? shelves : list}</div>
    </>
  );
}
