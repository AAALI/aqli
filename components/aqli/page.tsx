import type { ReactNode } from "react";

/**
 * The screen header every full-page view shares.
 *
 * The app had five variants of this — 42px serif with an eyebrow on home,
 * 36px on a space, 34px on "Needs updating", 28px with no eyebrow on Drafts,
 * and a 24px *sans* heading on the review queue — so no two screens announced
 * themselves the same way. One component, three sizes, one set of type rules.
 *
 * `size` is about the weight of the screen, not decoration: `hero` for the
 * workspace's front door, `page` for a destination you navigated to, `sub` for
 * a panel inside one.
 */
export function PageHeader({
  eyebrow,
  title,
  sub,
  action,
  size = "page",
  divider = false,
}: {
  /** The small uppercase line above the title. Says what kind of screen this is. */
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
  /** Buttons or status, aligned to the baseline of the title. */
  action?: ReactNode;
  size?: "hero" | "page" | "sub";
  /** A rule under the header — for screens that run straight into a list. */
  divider?: boolean;
}) {
  const fontSize = size === "hero" ? 42 : size === "page" ? 34 : 22;
  return (
    <header
      className="page-header"
      style={{
        paddingBottom: divider ? 22 : 0,
        borderBottom: divider ? "1px solid var(--border)" : undefined,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize,
            letterSpacing: size === "hero" ? "-0.018em" : "-0.015em",
            lineHeight: 1.1,
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h1>
        {sub && (
          <p
            style={{
              margin: 0,
              maxWidth: 640,
              fontSize: size === "hero" ? 16 : 14,
              lineHeight: 1.55,
              color: "var(--text-secondary)",
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

/** The small uppercase label used above titles and over grouped lists. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

/**
 * What a screen says when it has nothing to show.
 *
 * Two tones, because "nothing here" and "nothing left to do" are different
 * news and the app was already drawing them differently — a dashed slot that
 * invites you to fill it, versus a resolved state with a check. Keeping both
 * but naming them stops a third and fourth shape appearing.
 *
 * Neither is a placeholder for data that will arrive on its own: an empty
 * state is only correct when the query genuinely came back with nothing.
 */
export function EmptyState({
  tone = "empty",
  icon,
  title,
  children,
  action,
}: {
  tone?: "empty" | "clear";
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  if (tone === "clear") {
    return (
      <div className="empty-clear">
        {icon && <span className="empty-orb">{icon}</span>}
        <p
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 500,
            color: "var(--text-secondary)",
          }}
        >
          {title}
        </p>
        {children && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{children}</p>
        )}
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
    );
  }

  return (
    <div className="empty-slot">
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: "var(--text-primary)",
          marginBottom: children ? 6 : 0,
        }}
      >
        {title}
      </div>
      {children && (
        <p
          style={{
            margin: "0 auto",
            maxWidth: 420,
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          {children}
        </p>
      )}
      {action && <div style={{ marginTop: 22 }}>{action}</div>}
    </div>
  );
}
