import Link from "next/link";
import { IconWarn } from "@/components/aqli/icons";
import type { SchemaDrift } from "@/lib/preflight/drift";

/**
 * The screen an operator gets instead of "This page couldn't load".
 *
 * The audience is whoever deployed this — often the only person who can fix
 * it, and often someone who has never read this repository. So it says the
 * three things that turn a dead page into a five-minute job: what the database
 * is missing, which file adds it, and the command to run. The digest that Next
 * puts on the generic screen says none of them.
 *
 * Not an error boundary: this renders on the server, where the database's own
 * message still exists. In production Next strips that message before a client
 * boundary ever sees it, which is the whole reason the blank page was blank.
 */
export default function SchemaBehind({
  drift,
  healthHref,
}: {
  drift: SchemaDrift;
  /** Settings → Health, when we know which workspace we are in. */
  healthHref?: string;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background: "var(--bg-app, #fff)",
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "var(--stale-bg, #fef9c3)",
            color: "var(--stale-border, #a16207)",
            marginBottom: 18,
          }}
        >
          <IconWarn size={19} />
        </span>

        <h1
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 30,
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
            color: "var(--text-primary)",
          }}
        >
          The database is behind the code
        </h1>

        <p
          style={{
            margin: "0 0 18px",
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          This deployment is running code that expects something the database does not
          have yet, so the page could not be built. Nothing is broken and no data is
          lost — the migrations just have not been applied.
        </p>

        <dl
          style={{
            margin: "0 0 20px",
            padding: "14px 16px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-card)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {drift.object && (
            <Row label="Missing">
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{drift.object}</code>
            </Row>
          )}
          {drift.migration && (
            <Row label="Added by">
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                supabase/migrations/{drift.migration}
              </code>
              <span style={{ color: "var(--text-muted)" }}> (best guess, from the name)</span>
            </Row>
          )}
          <Row label="Database said">
            <span style={{ color: "var(--text-muted)" }}>{drift.detail}</span>
          </Row>
        </dl>

        <p style={{ margin: "0 0 8px", fontSize: 13.5, color: "var(--text-secondary)" }}>
          Apply everything in <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>supabase/migrations/</code>:
        </p>
        <pre
          style={{
            margin: "0 0 20px",
            padding: "10px 14px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-card)",
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            overflowX: "auto",
          }}
        >
          supabase db push
        </pre>

        {healthHref && (
          <Link
            href={healthHref}
            className="btn btn-secondary"
            style={{ height: 34, padding: "0 14px" }}
          >
            See the full report in Settings → Health
          </Link>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <dt
        style={{
          flex: "0 0 92px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, minWidth: 0, wordBreak: "break-word" }}>{children}</dd>
    </div>
  );
}
