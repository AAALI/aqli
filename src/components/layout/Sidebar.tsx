"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { Space } from "@/types/space";
import { setMobileNav, useMobileNav } from "./mobile-nav";
import { AqliWordmark } from "@/components/aqli/AqliMark";
import { IconHome, IconSearch, IconCheck, IconEdit } from "@/components/aqli/icons";
import SpaceIcon from "@/components/aqli/SpaceIcon";
import NewSpaceButton from "./NewSpaceButton";
import AccountMenu from "./AccountMenu";

type Props = {
  workspaceSlug: string;
  workspaceId: string;
  workspaceName: string;
  spaces: Space[];
  userName?: string;
  checksCount?: number;
  draftsCount?: number;
  /** Published docs per space, for the right-aligned mono count. */
  spaceCounts?: Record<string, number>;
};

/**
 * Four destinations, then your spaces (v3 §2).
 *
 * The "Workflow" group is gone. Review Queue became Checks and moved up to the
 * top level; "Needs updating" and "AI activity" are not destinations at all any
 * more — ageing is a state every doc carries wherever it appears, and agent
 * activity lives in Settings · AI access. Nine destinations, not twenty-eight.
 */
export default function Sidebar({
  workspaceSlug,
  workspaceId,
  workspaceName,
  spaces,
  userName = "You",
  checksCount = 0,
  draftsCount = 0,
  spaceCounts,
}: Props) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}`;
  const isHome = pathname === base;
  const isDrafts = pathname.startsWith(`${base}/drafts`);
  const isSearch = pathname.startsWith(`${base}/search`);
  const isChecks = pathname.startsWith(`${base}/checks`);
  const navOpen = useMobileNav();

  // On a phone the drawer covers the page, so following a link has to close it
  // — otherwise the destination renders underneath and looks like nothing
  // happened.
  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  return (
    <>
      {/* Scrim: only painted while the drawer is open, and only on mobile. */}
      <div
        className="sb-scrim"
        data-open={navOpen ? "" : undefined}
        onClick={() => setMobileNav(false)}
        aria-hidden="true"
      />
      <aside className="sb" data-open={navOpen ? "" : undefined}>
        <div className="sb-head">
          <Link href={base} style={{ textDecoration: "none" }}>
            <AqliWordmark />
          </Link>
          <div className="sb-workspace">{workspaceName}</div>
        </div>

        <div className="sb-nav">
          <Link href={base} className={`sb-item ${isHome ? "is-active" : ""}`}>
            <span className="sb-icon"><IconHome /></span>
            <span>Home</span>
          </Link>
          {/* Opens the ⌘K palette (same as the top-bar icon); the palette hands
              off to /search when the answer needs its sources shown. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("aqli:open-cmdk"))}
            className={`sb-item ${isSearch ? "is-active" : ""}`}
            style={{ background: "transparent", border: 0, width: "100%", textAlign: "left", fontFamily: "inherit" }}
          >
            <span className="sb-icon"><IconSearch /></span>
            <span>Search</span>
            <span className="sb-key">⌘K</span>
          </button>
          <Link href={`${base}/drafts`} className={`sb-item ${isDrafts ? "is-active" : ""}`}>
            <span className="sb-icon"><IconEdit /></span>
            <span>Drafts</span>
            {draftsCount > 0 && <span className="sb-count">{draftsCount}</span>}
          </Link>
          {/* Checks only exists when something is waiting: an empty queue is
              not a destination, and a zero is not information. */}
          {checksCount > 0 && (
            <Link href={`${base}/checks`} className={`sb-item ${isChecks ? "is-active" : ""}`}>
              <span className="sb-icon"><IconCheck /></span>
              <span>Checks</span>
              <span className="sb-count is-due">{checksCount}</span>
            </Link>
          )}
        </div>

        <div className="sb-section-label">Spaces</div>
        <div className="sb-nav" style={{ paddingTop: 0, overflowY: "auto" }}>
          {spaces.map((s) => {
            const active = pathname.startsWith(`${base}/s/${s.slug}`);
            // An empty space counts 0 rather than showing nothing — frame 04's
            // first-run sidebar reads "Company 0", and a missing number would
            // look like a number that failed to load.
            const count = spaceCounts ? (spaceCounts[s.id] ?? 0) : undefined;
            return (
              <Link key={s.id} href={`${base}/s/${s.slug}`} className={`sb-item ${active ? "is-active" : ""}`}>
                <span className="sb-emoji"><SpaceIcon icon={s.icon} /></span>
                <span>{s.name}</span>
                {count !== undefined && <span className="sb-count">{count}</span>}
              </Link>
            );
          })}
          <NewSpaceButton workspaceId={workspaceId} />
        </div>

        {/* Name over workspace, not name over URL — the footer says who you are
            and where you are, which is what frames 04 and 07 show. */}
        <AccountMenu base={base} userName={userName} workspaceSlug={workspaceSlug} roleLabel={workspaceName} />
      </aside>
    </>
  );
}
