import Link from "next/link";
import { StatusBadge, TypeBadge } from "@/components/aqli/badges";
import { IconChevRight } from "@/components/aqli/icons";
import { typeLabel, statusLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

export type Shelf = { name: string; desc?: string; docs: DocWithSpace[] };

/**
 * The "library" view of a space — canonical entry points up top, then docs
 * clustered into topic (or type) shelves rather than one flat list. Renders
 * from real docs; reading-paths and gaps are noted as follow-ups (they need
 * curation / query-log data that doesn't exist yet).
 */
export default function ShelvesView({
  base,
  startHere,
  shelves,
  shelfBasis,
}: {
  base: string;
  startHere: DocWithSpace[];
  shelves: Shelf[];
  shelfBasis: "topic" | "type";
}) {
  return (
    <div>
      {startHere.length > 0 && (
        <section style={{ marginBottom: 44 }}>
          <SectionHead
            eyebrow="Start here"
            title="Approved docs to read first"
            right={<span>The current, trusted entry points</span>}
          />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${startHere.length}, 1fr)`, gap: 12 }}>
            {startHere.map((d, i) => (
              <Link
                key={d.id}
                href={`${base}/docs/${d.id}`}
                style={{
                  padding: "18px 18px 16px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: "var(--accent)",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <TypeBadge type={typeLabel(d.type)} />
                  {d.last_reviewed_at && (
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                      verified {formatRelative(d.last_reviewed_at)}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 19,
                    color: "var(--text-primary)",
                    lineHeight: 1.25,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {d.title}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div
        style={{
          marginBottom: 12,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {shelfBasis === "topic" ? "By topic" : "By type"}
      </div>

      {shelves.map((s) => (
        <section key={s.name} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                color: "var(--text-primary)",
                letterSpacing: "-0.005em",
              }}
            >
              {s.name}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {s.docs.length} doc{s.docs.length === 1 ? "" : "s"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {s.docs.map((d) => (
              <ShelfDocRow key={d.id} base={base} doc={d} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ShelfDocRow({ base, doc }: { base: string; doc: DocWithSpace }) {
  const isStale = doc.status === "stale";
  return (
    <Link
      href={`${base}/docs/${doc.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        textDecoration: "none",
      }}
    >
      <TypeBadge type={typeLabel(doc.type)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 14.5,
            color: "var(--text-primary)",
            letterSpacing: "-0.005em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {doc.title}
        </span>
        <span style={{ fontSize: 11.5, color: isStale ? "var(--stale-text)" : "var(--text-muted)" }}>
          {doc.last_reviewed_at ? `verified ${formatRelative(doc.last_reviewed_at)}` : "not verified"}
        </span>
      </div>
      <StatusBadge status={statusLabel(doc.status)} />
      <span style={{ color: "var(--text-muted)" }}>
        <IconChevRight size={14} />
      </span>
    </Link>
  );
}

function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 16,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {eyebrow}
        </div>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h2>
      </div>
      {right && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{right}</span>}
    </div>
  );
}
