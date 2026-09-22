import Link from "next/link";
import { Fragment } from "react";
import { IconChevRight, IconPlus } from "@/components/aqli/icons";
import CmdKButton from "@/components/cmdk/CmdKButton";

export type Crumb = { label: string; href?: string };

/**
 * The 54px top bar of every screen that has a sidebar (v3 §2).
 *
 * A breadcrumb, at most one primary action, and search. There is no
 * notification bell: what used to arrive there now arrives on Home, under
 * "Waiting on you", and in Checks — places you go on purpose rather than a
 * badge that asks to be cleared.
 */
export default function AppTopBar({
  crumbs,
  primary,
  secondary,
  actions,
}: {
  crumbs: Crumb[];
  primary?: { label: string; href: string } | null;
  secondary?: { label: string; href: string } | null;
  /** Screen-specific actions, rendered ahead of search. */
  actions?: React.ReactNode;
  /** Retained for call sites not yet rebuilt; the bell is gone. */
  base?: string;
}) {
  return (
    <div className="tb">
      <nav className="tb-crumb" aria-label="Breadcrumb">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <span className="crumb-sep"><IconChevRight size={12} /></span>}
              {c.href && !last ? (
                <Link href={c.href}>{c.label}</Link>
              ) : (
                <span className={last ? "crumb-cur" : ""}>{c.label}</span>
              )}
            </Fragment>
          );
        })}
      </nav>
      <div className="tb-spacer" />
      <div className="tb-actions">
        {actions}
        {secondary && (
          <Link href={secondary.href} className="btn btn-secondary">
            {secondary.label}
          </Link>
        )}
        {primary && (
          <Link href={primary.href} className="btn btn-primary">
            <IconPlus size={14} />
            {primary.label}
          </Link>
        )}
        <CmdKButton />
      </div>
    </div>
  );
}
