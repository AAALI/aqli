"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { typeLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import { IconArrowUpRight, IconChat } from "@/components/aqli/icons";
import type { Backlink } from "@/lib/supabase/docs";

type Heading = { id: string; text: string; level: number };

/** A comment reduced to what the rail shows. */
export type DiscussionEntry = {
  id: string;
  author: string | null;
  excerpt: string;
  createdAt: string;
};

// The scroll container the reading column lives in (see the doc view page).
const SCROLLER_ID = "doc-scroll";
const COMMENTS_ID = "doc-comments";

function RailLabel({ children }: { children: React.ReactNode }) {
  return <div className="rail-label">{children}</div>;
}

function RailCount({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
      {children}
    </span>
  );
}

/** Scroll the reading column to an element. */
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

/**
 * The viewer's right rail: where this page sits, who points at it, and what
 * people are saying about it. Every block is backed by a query — the empty
 * states below only appear when the query genuinely came back with nothing.
 */
export default function ReadingRail({
  base,
  backlinks,
  discussion,
  discussionCount,
  discussionFailed,
}: {
  base: string;
  backlinks: Backlink[];
  discussion: DiscussionEntry[];
  discussionCount: number;
  /** The thread failed to load — distinct from "there are no comments". */
  discussionFailed: boolean;
}) {
  return (
    <aside
      className="doc-rail"
      style={{
        borderLeft: "1px solid var(--border)",
        background: "var(--bg-card)",
        overflowY: "auto",
      }}
    >
      <OnThisPage />
      <CitedBy base={base} backlinks={backlinks} />
      <Discussion
        entries={discussion}
        total={discussionCount}
        failed={discussionFailed}
      />
    </aside>
  );
}

// ── On this page ─────────────────────────────────────────────────────

function OnThisPage() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Read headings out of the rendered body. The body renders asynchronously
  // (the editor hydrates after mount), so observe it for changes too.
  useEffect(() => {
    const body = document.getElementById("doc-body");
    if (!body) return;

    const scan = () => {
      const nodes = Array.from(body.querySelectorAll<HTMLElement>("h1, h2, h3"));
      const next: Heading[] = nodes.map((node, i) => {
        if (!node.id)
          node.id = `h-${i}-${(node.textContent ?? "").slice(0, 24).replace(/\W+/g, "-")}`;
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

  return (
    <div className="rail-block">
      <RailLabel>On this page</RailLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 8 }}>
        {headings.length === 0 ? (
          <div className="rail-empty" style={{ padding: "4px 8px" }}>
            This doc runs straight through — no sections to jump between.
          </div>
        ) : (
          headings.map((h) => (
            <button
              type="button"
              key={h.id}
              onClick={() => jump(h.id)}
              className={`ol-item${h.id === activeId ? " cur" : ""}`}
              style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
            >
              <span className="ol-text">{h.text}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Cited by ─────────────────────────────────────────────────────────

function CitedBy({ base, backlinks }: { base: string; backlinks: Backlink[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? backlinks : backlinks.slice(0, 5);

  return (
    <div className="rail-block">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <RailLabel>Cited by</RailLabel>
        {backlinks.length > 0 && <RailCount>{backlinks.length}</RailCount>}
      </div>

      {backlinks.length === 0 ? (
        <div className="rail-empty">
          Nothing cites this yet. It will show up here the moment another doc
          quotes or links it.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((b) => (
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
                  flexWrap: "wrap",
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
                {b.citesSection && (
                  <>
                    <span>·</span>
                    <span>cites {b.citesSection}</span>
                  </>
                )}
              </span>
            </Link>
          ))}
          {backlinks.length > 5 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
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
  );
}

// ── Discussion ───────────────────────────────────────────────────────

function Discussion({
  entries,
  total,
  failed,
}: {
  entries: DiscussionEntry[];
  total: number;
  failed: boolean;
}) {
  return (
    <div className="rail-block" style={{ paddingBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <RailLabel>Discussion</RailLabel>
        {total > 0 && <RailCount>{total}</RailCount>}
      </div>

      {failed ? (
        <div className="rail-empty">
          Couldn&rsquo;t load the discussion. The thread is still on the page below.
        </div>
      ) : entries.length === 0 ? (
        <div className="rail-empty" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>No one has asked anything about this doc yet.</span>
          <button
            type="button"
            onClick={() => jump(COMMENTS_ID)}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "transparent",
              border: 0,
              padding: 0,
              fontSize: 12,
              fontWeight: 500,
              color: "var(--accent)",
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
            }}
          >
            <IconChat size={11} />
            Start the thread
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                  {e.author ?? "Someone"}
                </span>
                <span>·</span>
                <span suppressHydrationWarning>{formatRelative(e.createdAt)}</span>
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: "var(--text-primary)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {e.excerpt}
              </span>
            </div>
          ))}

          <button
            type="button"
            onClick={() => jump(COMMENTS_ID)}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: 0,
              padding: 0,
              fontSize: 12,
              fontWeight: 500,
              color: "var(--accent)",
              fontFamily: "var(--font-sans)",
              cursor: "pointer",
            }}
          >
            {total > entries.length
              ? `Open all ${total} →`
              : total === 1
                ? "Open →"
                : `Open ${total} →`}
            <IconArrowUpRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}
