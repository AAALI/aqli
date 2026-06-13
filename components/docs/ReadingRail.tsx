"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { typeLabel } from "@/lib/doc-display";
import type { Backlink } from "@/lib/supabase/docs";

type Heading = { id: string; text: string; level: number };

// The scroll container the reading column lives in (see the doc view page).
const SCROLLER_ID = "doc-scroll";

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * The viewer's right rail — the wiki-page scaffolding the brief asks for:
 * a live outline of the doc and the "cited by" backlinks. Headings are read
 * from the rendered doc body (`#doc-body`) so the outline always matches what
 * the reader sees, and clicking one scrolls to it.
 */
export default function ReadingRail({
  base,
  backlinks,
}: {
  base: string;
  backlinks: Backlink[];
}) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAllLinks, setShowAllLinks] = useState(false);

  // Read headings out of the rendered body. The body renders asynchronously
  // (the editor hydrates after mount), so observe it for changes too.
  useEffect(() => {
    const body = document.getElementById("doc-body");
    if (!body) return;

    const scan = () => {
      const nodes = Array.from(
        body.querySelectorAll<HTMLElement>("h1, h2, h3"),
      );
      const next: Heading[] = nodes.map((node, i) => {
        if (!node.id) node.id = `h-${i}-${(node.textContent ?? "").slice(0, 24).replace(/\W+/g, "-")}`;
        return {
          id: node.id,
          text: node.textContent || "Untitled section",
          level: Number(node.tagName.slice(1)),
        };
      });
      setHeadings((prev) =>
        prev.length === next.length && prev.every((h, i) => h.id === next[i].id)
          ? prev
          : next,
      );
    };

    scan();
    const mo = new MutationObserver(scan);
    mo.observe(body, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);

  // Track the section currently in view to highlight it in the outline.
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      {
        root: document.getElementById(SCROLLER_ID),
        rootMargin: "0px 0px -70% 0px",
        threshold: 0,
      },
    );
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  // Scroll the reading column directly. The read-only editor nests a
  // (non-scrollable) overflow container that smooth `scrollIntoView` would
  // otherwise target, so we compute the offset against `#doc-scroll` instead.
  function jump(id: string) {
    const el = document.getElementById(id);
    const scroller = document.getElementById(SCROLLER_ID);
    if (!el || !scroller) return;
    const top =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - 16), behavior: "smooth" });
  }

  const visibleLinks = showAllLinks ? backlinks : backlinks.slice(0, 5);

  return (
    <aside
      style={{
        width: 280,
        flex: "0 0 280px",
        borderLeft: "1px solid var(--border)",
        background: "var(--bg-card)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Outline */}
      <div style={{ padding: "20px 20px 16px" }}>
        <RailLabel>On this page</RailLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 8 }}>
          {headings.length === 0 ? (
            <div style={{ padding: "4px 8px", fontSize: 12.5, color: "var(--text-muted)" }}>
              No sections yet.
            </div>
          ) : (
            headings.map((h) => {
              const current = h.id === activeId;
              return (
                <button
                  key={h.id}
                  onClick={() => jump(h.id)}
                  style={{
                    textAlign: "left",
                    border: 0,
                    cursor: "pointer",
                    padding: "4px 8px",
                    paddingLeft: 8 + (h.level - 1) * 12,
                    fontSize: 13,
                    fontFamily: "var(--font-sans)",
                    fontWeight: current ? 500 : 400,
                    color: current ? "var(--accent)" : "var(--text-primary)",
                    background: current ? "var(--accent-light)" : "transparent",
                    borderRadius: 5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.text}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }} />

      {/* Cited by */}
      <div style={{ padding: "16px 20px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <RailLabel>Cited by</RailLabel>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {backlinks.length}
          </span>
        </div>

        {backlinks.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            No other docs cite this one yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visibleLinks.map((b) => (
              <Link
                key={b.id}
                href={`${base}/docs/${b.id}`}
                style={{ display: "flex", flexDirection: "column", gap: 3, textDecoration: "none" }}
              >
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1.35,
                    color: "var(--text-primary)",
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {b.title}
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {typeLabel(b.type)}
                  </span>
                  {b.space && (
                    <>
                      <span>·</span>
                      <span>{b.space.name}</span>
                    </>
                  )}
                </span>
              </Link>
            ))}
            {backlinks.length > 5 && !showAllLinks && (
              <button
                onClick={() => setShowAllLinks(true)}
                style={{
                  textAlign: "left",
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--accent)",
                  fontFamily: "var(--font-sans)",
                  padding: 0,
                  marginTop: 2,
                }}
              >
                See all {backlinks.length} →
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
