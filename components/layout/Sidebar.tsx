"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Space } from "@/types/space";
import { AqliWordmark } from "@/components/aqli/AqliMark";
import { IconHome, IconSearch, IconCheck, IconClock, IconRobot, IconEdit } from "@/components/aqli/icons";
import NewSpaceButton from "./NewSpaceButton";
import AccountMenu from "./AccountMenu";

type Props = {
  workspaceSlug: string;
  workspaceId: string;
  workspaceName: string;
  spaces: Space[];
  userName?: string;
  reviewCount?: number;
  staleCount?: number;
};

export default function Sidebar({
  workspaceSlug,
  workspaceId,
  workspaceName,
  spaces,
  userName = "You",
  reviewCount = 0,
  staleCount = 0,
}: Props) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}`;
  const isHome = pathname === base;
  const isDrafts = pathname.startsWith(`${base}/drafts`);
  const isSearch = pathname.startsWith(`${base}/search`);
  const isReview = pathname.startsWith(`${base}/review`);
  const isStale = pathname.startsWith(`${base}/stale`);
  const isAgentLog = pathname.startsWith(`${base}/agent-log`);

  return (
    <aside className="sb">
      <div className="sb-head">
        <Link href={base} style={{ textDecoration: "none" }}>
          <AqliWordmark />
        </Link>
        <div className="sb-workspace">{workspaceName} · Workspace</div>
      </div>

      {/* Knowledge-first: what you know, write, and find come first. */}
      <div className="sb-nav">
        <Link href={base} className={`sb-item ${isHome ? "is-active" : ""}`}>
          <span className="sb-icon"><IconHome /></span>
          <span>Home</span>
        </Link>
        <Link href={`${base}/drafts`} className={`sb-item ${isDrafts ? "is-active" : ""}`}>
          <span className="sb-icon"><IconEdit /></span>
          <span>Drafts</span>
        </Link>
        <Link href={`${base}/search`} className={`sb-item ${isSearch ? "is-active" : ""}`}>
          <span className="sb-icon"><IconSearch /></span>
          <span>Search</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>⌘K</span>
        </Link>
      </div>

      {/* Process surfaces are tools for the job, not the destination — demoted
          below the knowledge-first nav. Reviews also surface on Home. */}
      <div className="sb-section-label">Workflow</div>
      <div className="sb-nav" style={{ paddingTop: 0 }}>
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
          {staleCount > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--stale-text)", background: "var(--stale-bg)", border: "1px solid var(--stale-border)", padding: "0 6px", borderRadius: 999, lineHeight: "16px", height: 16 }}>
              {staleCount}
            </span>
          )}
        </Link>
        <Link href={`${base}/agent-log`} className={`sb-item ${isAgentLog ? "is-active" : ""}`}>
          <span className="sb-icon"><IconRobot /></span>
          <span>Agent log</span>
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

      <AccountMenu base={base} userName={userName} workspaceSlug={workspaceSlug} />
    </aside>
  );
}
