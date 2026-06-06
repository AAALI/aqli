"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Space } from "@/types/space";
import { AqliWordmark } from "@/components/aqli/AqliMark";
import { IconHome, IconSearch, IconCheck, IconGear, IconClock } from "@/components/aqli/icons";
import NewSpaceButton from "./NewSpaceButton";

type Props = {
  workspaceSlug: string;
  workspaceId: string;
  workspaceName: string;
  spaces: Space[];
  userName?: string;
  reviewCount?: number;
};

export default function Sidebar({
  workspaceSlug,
  workspaceId,
  workspaceName,
  spaces,
  userName = "You",
  reviewCount = 3,
}: Props) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}`;
  const initial = userName.trim().charAt(0).toUpperCase() || "Y";

  const isHome = pathname === base;
  const isSearch = pathname.startsWith(`${base}/search`);
  const isReview = pathname.startsWith(`${base}/review`);
  const isStale = pathname.startsWith(`${base}/stale`);

  return (
    <aside className="sb">
      <div className="sb-head">
        <Link href={base} style={{ textDecoration: "none" }}>
          <AqliWordmark />
        </Link>
        <div className="sb-workspace">{workspaceName} · Workspace</div>
      </div>

      <div className="sb-nav">
        <Link href={base} className={`sb-item ${isHome ? "is-active" : ""}`}>
          <span className="sb-icon"><IconHome /></span>
          <span>Home</span>
        </Link>
        <Link href={`${base}/search`} className={`sb-item ${isSearch ? "is-active" : ""}`}>
          <span className="sb-icon"><IconSearch /></span>
          <span>Search</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>⌘K</span>
        </Link>
        <Link href={`${base}/review`} className={`sb-item ${isReview ? "is-active" : ""}`}>
          <span className="sb-icon"><IconCheck /></span>
          <span>Review Queue</span>
          {reviewCount > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--review-text)", background: "var(--review-bg)", border: "1px solid var(--review-border)", padding: "0 6px", borderRadius: 999, lineHeight: "16px", height: 16 }}>
              {reviewCount}
            </span>
          )}
        </Link>
        <Link href={`${base}/stale`} className={`sb-item ${isStale ? "is-active" : ""}`}>
          <span className="sb-icon"><IconClock /></span>
          <span>Stale docs</span>
        </Link>
      </div>

      <div className="sb-section-label">Spaces</div>
      <div className="sb-nav" style={{ paddingTop: 0, overflowY: "auto" }}>
        {spaces.map((s) => {
          const active = pathname.startsWith(`${base}/s/${s.slug}`);
          return (
            <Link key={s.id} href={`${base}/s/${s.slug}`} className={`sb-item ${active ? "is-active" : ""}`}>
              <span className="sb-emoji">{s.icon}</span>
              <span>{s.name}</span>
            </Link>
          );
        })}
        <NewSpaceButton workspaceId={workspaceId} />
      </div>

      <div className="sb-foot">
        <div className="avatar avatar-ali">{initial}</div>
        <div className="meta">
          <span className="n">{userName}</span>
          <span className="w">aqli.app/{workspaceSlug}</span>
        </div>
        <Link href={`${base}/settings`} className="gear" aria-label="Settings">
          <IconGear size={15} />
        </Link>
      </div>
    </aside>
  );
}
