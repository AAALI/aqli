import Link from "next/link";
import { Fragment } from "react";
import { IconChevRight, IconPlus } from "@/components/aqli/icons";

export type Crumb = { label: string; href?: string };

export default function AppTopBar({
  crumbs,
  saved,
  primary,
  share,
  userInitial = "Y",
}: {
  /** Workspace base path (e.g. `/w/acme`). Accepted by callers; reserved for
   *  top-bar features that need workspace context. */
  base?: string;
  crumbs: Crumb[];
  saved?: string | null;
  primary?: { label: string; href: string } | null;
  share?: boolean;
  userInitial?: string;
}) {
  return (
    <div className="tb">
      <div className="tb-crumb">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <span className="crumb-sep"><IconChevRight size={12} /></span>}
              {c.href && !last ? (
                <Link href={c.href} className={last ? "crumb-cur" : ""}>{c.label}</Link>
              ) : (
                <span className={last ? "crumb-cur" : ""}>{c.label}</span>
              )}
            </Fragment>
          );
        })}
        {saved && (
          <span className="crumb-saved">
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} />
            {saved}
          </span>
        )}
      </div>
      <div className="tb-spacer" />
      <div className="tb-actions">
        {share && <button className="btn btn-secondary">Share</button>}
        {primary && (
          <Link href={primary.href} className="btn btn-primary">
            <IconPlus size={14} />
            {primary.label}
          </Link>
        )}
        <div className="avatar avatar-sm avatar-ali">{userInitial}</div>
      </div>
    </div>
  );
}
