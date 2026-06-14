"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  IconSearch,
  IconSparkle,
  IconPlus,
  IconKey,
  IconUsers,
  IconGear,
  IconLogOut,
} from "@/components/aqli/icons";
import { typeLabel, statusLabel } from "@/lib/doc-display";

type DocLite = {
  id: string;
  title: string;
  type: string;
  status: string;
  space_id: string | null;
};
type SpaceLite = { id: string; name: string; slug: string; icon: string };

type FilterKind = "All" | "Docs" | "Actions";
type ItemKind = "doc" | "ask" | "action" | "space" | "setting";

type Item = {
  id: string;
  kind: ItemKind;
  group: string;
  icon: React.ReactNode;
  tone?: "accent" | "agent";
  title: React.ReactNode;
  subtitle?: string;
  shortcut?: string[];
  run: () => void;
};

const GROUP_ORDER = ["Docs", "Recent", "Ask Aqli", "Quick actions", "Spaces", "Settings"];

export default function CommandPalette({
  workspaceSlug,
  workspaceId,
  spaces,
  recentDocs,
}: {
  workspaceSlug: string;
  workspaceId: string;
  spaces: SpaceLite[];
  recentDocs: DocLite[];
}) {
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKind>("All");
  const [results, setResults] = useState<DocLite[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const spaceName = useMemo(() => {
    const m = new Map(spaces.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? (m.get(id) ?? "") : "");
  }, [spaces]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  // Open with a clean slate (resets live in event handlers, not an effect).
  const openPalette = useCallback(() => {
    setQuery("");
    setFilter("All");
    setResults([]);
    setActive(0);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Open on ⌘K / Ctrl+K (or a dispatched event from a top-bar trigger); close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("aqli:open-cmdk", openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aqli:open-cmdk", openPalette);
    };
  }, [open, openPalette]);

  // Debounced doc search. (Idle uses recentDocs and ignores `results`, so a
  // cleared query needs no synchronous reset here.)
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&workspace_id=${workspaceId}`,
        );
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, workspaceId]);

  const signOut = useCallback(async () => {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  // Build the item list for the current state.
  const items = useMemo<Item[]>(() => {
    const q = query.trim();
    const out: Item[] = [];

    if (q) {
      for (const d of results) {
        out.push({
          id: `doc-${d.id}`,
          kind: "doc",
          group: "Docs",
          icon: <TypeGlyph type={d.type} />,
          title: d.title,
          subtitle: [spaceName(d.space_id), statusLabel(d.status)].filter(Boolean).join(" · "),
          shortcut: ["↵"],
          run: () => go(`${base}/docs/${d.id}`),
        });
      }
      out.push({
        id: "ask",
        kind: "ask",
        group: "Ask Aqli",
        icon: <IconSparkle size={13} />,
        tone: "accent",
        title: `Ask Aqli: “${q}”`,
        subtitle: "Search approved docs for an answer",
        shortcut: ["Tab"],
        run: () => go(`${base}/search?q=${encodeURIComponent(q)}`),
      });
      const firstSpace = spaces[0];
      if (firstSpace) {
        out.push({
          id: "create-named",
          kind: "action",
          group: "Quick actions",
          icon: <IconPlus size={13} />,
          tone: "accent",
          title: `Create a new doc`,
          subtitle: `Start a draft in ${firstSpace.name}`,
          run: () => go(`${base}/s/${firstSpace.slug}/new`),
        });
      }
      return out;
    }

    // Idle
    for (const d of recentDocs.slice(0, 5)) {
      out.push({
        id: `recent-${d.id}`,
        kind: "doc",
        group: "Recent",
        icon: <TypeGlyph type={d.type} />,
        title: d.title,
        subtitle: [spaceName(d.space_id), statusLabel(d.status)].filter(Boolean).join(" · "),
        run: () => go(`${base}/docs/${d.id}`),
      });
    }
    const firstSpace = spaces[0];
    out.push({
      id: "new-doc",
      kind: "action",
      group: "Quick actions",
      icon: <IconPlus size={13} />,
      tone: "accent",
      title: "Create new doc…",
      subtitle: "Pick a type and template",
      shortcut: ["C"],
      run: () => go(firstSpace ? `${base}/s/${firstSpace.slug}/new` : base),
    });
    out.push({
      id: "invite",
      kind: "action",
      group: "Quick actions",
      icon: <IconUsers size={13} />,
      title: "Invite a teammate…",
      subtitle: "Add someone to this workspace",
      run: () => go(`${base}/settings/members`),
    });
    out.push({
      id: "api-key",
      kind: "action",
      group: "Quick actions",
      icon: <IconKey size={13} />,
      title: "Create an API key…",
      subtitle: "Connect another agent",
      run: () => go(`${base}/settings/keys`),
    });
    for (const s of spaces) {
      out.push({
        id: `space-${s.id}`,
        kind: "space",
        group: "Spaces",
        icon: <span style={{ fontSize: 13 }}>{s.icon}</span>,
        title: `Go to ${s.name}`,
        run: () => go(`${base}/s/${s.slug}`),
      });
    }
    out.push({
      id: "settings",
      kind: "setting",
      group: "Settings",
      icon: <IconGear size={13} />,
      title: "Workspace settings",
      run: () => go(`${base}/settings`),
    });
    out.push({
      id: "signout",
      kind: "setting",
      group: "Settings",
      icon: <IconLogOut size={13} />,
      title: "Sign out",
      run: signOut,
    });
    return out;
  }, [query, results, recentDocs, spaces, base, go, signOut, spaceName]);

  // Apply the active filter pill.
  const visible = useMemo(() => {
    if (filter === "All") return items;
    if (filter === "Docs") return items.filter((i) => i.kind === "doc");
    return items.filter((i) => i.kind !== "doc");
  }, [items, filter]);

  // Clamp the active index for use/display without an effect.
  const activeIdx = visible.length ? Math.min(active, visible.length - 1) : 0;

  // List navigation while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, visible.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        visible[activeIdx]?.run();
      } else if (e.key === "Tab") {
        // Always trap Tab while the palette is open so focus never escapes to
        // the page behind it; run Ask Aqli when that row is available.
        e.preventDefault();
        visible.find((i) => i.kind === "ask")?.run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, visible, activeIdx]);

  // Scroll the active row into view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  if (!open) return null;

  // Group visible items in display order, tracking each item's flat index.
  const indexOf = new Map(visible.map((it, i) => [it.id, i]));
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    items: visible.filter((it) => it.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,18,0.42)",
        backdropFilter: "blur(3px)",
        zIndex: 200,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 96,
          left: "50%",
          transform: "translateX(-50%)",
          width: 640,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 24px 60px -16px rgba(20,20,18,0.32), 0 4px 16px rgba(20,20,18,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: 56,
            padding: "0 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--text-muted)", display: "flex" }}>
            <IconSearch size={17} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs, or run a command…"
            style={{
              flex: 1,
              border: 0,
              outline: "none",
              background: "transparent",
              fontSize: 15.5,
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
            }}
          />
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-base)",
          }}
        >
          {(["All", "Docs", "Actions"] as FilterKind[]).map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  height: 24,
                  padding: "0 10px",
                  borderRadius: 999,
                  background: on ? "var(--bg-card)" : "transparent",
                  border: `1px solid ${on ? "var(--border-strong)" : "transparent"}`,
                  color: on ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: on ? 500 : 400,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 420, overflowY: "auto", padding: "4px 0 8px" }}>
          {visible.length === 0 ? (
            <div style={{ padding: "28px 18px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
              {query.trim() ? "No matches. Try Ask Aqli or a different term." : "Nothing here yet."}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.group}>
                <div
                  style={{
                    padding: "10px 18px 4px",
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  {g.group}
                </div>
                {g.items.map((it) => {
                  const idx = indexOf.get(it.id)!;
                  return (
                    <Row
                      key={it.id}
                      idx={idx}
                      item={it}
                      active={idx === activeIdx}
                      onHover={() => setActive(idx)}
                      onClick={() => it.run()}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-base)",
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 11.5,
            color: "var(--text-muted)",
          }}
        >
          <Help kbd="↑↓" label="Navigate" />
          <Help kbd="↵" label="Select" />
          <Help kbd="Tab" label="Ask Aqli" />
          <Help kbd="esc" label="Close" />
        </div>
      </div>
    </div>
  );
}

function Row({
  idx,
  item,
  active,
  onHover,
  onClick,
}: {
  idx: number;
  item: Item;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const toneBg =
    item.tone === "accent" ? "var(--accent-light)" : item.tone === "agent" ? "var(--agent-tint)" : "var(--bg-sidebar)";
  const toneColor =
    item.tone === "accent" ? "var(--accent)" : item.tone === "agent" ? "var(--agent-icon)" : "var(--text-secondary)";
  const toneBorder =
    item.tone === "accent" ? "rgba(15,110,86,0.25)" : item.tone === "agent" ? "var(--agent-border)" : "var(--border)";

  return (
    <div
      data-idx={idx}
      onMouseEnter={onHover}
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "30px 1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "10px 18px",
        background: active ? "var(--bg-sidebar)" : "transparent",
        borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          background: toneBg,
          color: toneColor,
          border: `1px solid ${toneBorder}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "-0.005em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </span>
        {item.subtitle && (
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.subtitle}
          </span>
        )}
      </div>
      {item.shortcut && (
        <div style={{ display: "inline-flex", gap: 4 }}>
          {item.shortcut.map((k, i) => (
            <kbd
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                background: active ? "var(--bg-card)" : "var(--bg-sidebar)",
                border: "1px solid var(--border)",
                borderRadius: 3,
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--text-secondary)",
              }}
            >
              {k}
            </kbd>
          ))}
        </div>
      )}
    </div>
  );
}

function TypeGlyph({ type }: { type: string }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: "0.04em" }}>
      {typeLabel(type).slice(0, 3).toUpperCase()}
    </span>
  );
}

function Help({ kbd, label }: { kbd: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <kbd
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 18,
          height: 17,
          padding: "0 5px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-secondary)",
        }}
      >
        {kbd}
      </kbd>
      {label}
    </span>
  );
}
