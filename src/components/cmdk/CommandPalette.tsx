"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChat, IconEdit, IconSearch } from "@/components/aqli/icons";
import SpaceIcon from "@/components/aqli/SpaceIcon";
import Status from "@/components/docs/Status";
import { docState, isPublished } from "@/lib/doc-status";
import { formatRelative } from "@/lib/utils";
import type { DocStatus } from "@/types/doc";
import type { VerifyCadence } from "@/lib/verify-cadence";

type DocLite = {
  id: string;
  title: string;
  type: string;
  status: DocStatus;
  space_id: string | null;
  owner_id?: string | null;
  updated_at: string;
  last_reviewed_at: string | null;
  frontmatter: { verify_cadence?: VerifyCadence; source_pr_url?: string } | null;
};
type SpaceLite = { id: string; name: string; slug: string; icon: string };

type Item = {
  id: string;
  group: "Jump to" | "Ask Aqli" | "Write";
  lead: React.ReactNode;
  title: string;
  sub: string;
  run: () => void;
};

const PATTERNS = [
  { type: "how_to", name: "How-to" },
  { type: "decision", name: "Decision" },
  { type: "brief", name: "Brief" },
];

/**
 * ⌘K (v3 §2, §4, frame 23): jump to a doc, ask a question, or start writing.
 *
 * Three groups, one list, arrow keys and Return. A doc leads with the same
 * status dot it carries everywhere else. While a new query is fetching, the
 * last results stay on screen — no empty flash between keystrokes.
 */
export default function CommandPalette({
  workspaceSlug,
  workspaceId,
  spaces,
  recentDocs,
  currentUserId,
}: {
  workspaceSlug: string;
  workspaceId: string;
  spaces: SpaceLite[];
  recentDocs: DocLite[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) setOpen(false);
        else openPalette();
      } else if (e.key === "Escape" && open) {
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

  // Debounced search. Results are replaced only when new ones arrive, so the
  // list never blanks while the next query is in flight (§4).
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&workspace_id=${workspaceId}`);
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        // Keep what is showing.
      }
    }, 160);
    return () => clearTimeout(t);
  }, [query, workspaceId]);

  const writeHref = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams(extra);
      if (spaces[0]) p.set("space", spaces[0].slug);
      const s = p.toString();
      return `${base}/write${s ? `?${s}` : ""}`;
    },
    [base, spaces],
  );

  const items = useMemo<Item[]>(() => {
    const q = query.trim();
    const docs = (q ? results : recentDocs)
      // Nobody else's draft, ever (§3.2).
      .filter((d) => isPublished(d.status) || d.owner_id === currentUserId)
      .slice(0, q ? 6 : 5);
    const out: Item[] = docs.map((d) => ({
      id: `doc-${d.id}`,
      group: "Jump to",
      lead: isPublished(d.status) ? <Status doc={d} form="dot" /> : <span style={{ width: 7, display: "inline-block" }} />,
      title: d.title || "Untitled",
      sub: [spaceName(d.space_id), describe(d, currentUserId)].filter(Boolean).join(" · "),
      run: () => go(`${base}/docs/${d.id}${isPublished(d.status) ? "" : "/edit"}`),
    }));
    if (q) {
      for (const s of spaces.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 2)) {
        out.push({
          id: `space-${s.id}`,
          group: "Jump to",
          lead: <span style={{ color: "var(--text-muted)", display: "flex" }}><SpaceIcon icon={s.icon} size={15} /></span>,
          title: s.name,
          sub: "Space",
          run: () => go(`${base}/s/${s.slug}`),
        });
      }
      out.push({
        id: "ask",
        group: "Ask Aqli",
        lead: <span style={{ color: "var(--accent)", display: "flex" }}><IconChat size={15} /></span>,
        title: q.endsWith("?") ? q : `${q}?`,
        sub: "Answers from what your team wrote, with the sources",
        run: () => go(`${base}/search?q=${encodeURIComponent(q)}`),
      });
      out.push({
        id: "write-titled",
        group: "Write",
        lead: <span style={{ color: "var(--text-muted)", display: "flex" }}><IconEdit size={15} /></span>,
        title: `New doc: “${q}”`,
        sub: "⌘⏎ from here",
        run: () => go(writeHref({ title: q })),
      });
    } else {
      out.push({
        id: "write-blank",
        group: "Write",
        lead: <span style={{ color: "var(--text-muted)", display: "flex" }}><IconEdit size={15} /></span>,
        title: "New blank doc",
        sub: "⌘K then ⌘⏎",
        run: () => go(writeHref()),
      });
      for (const p of PATTERNS) {
        out.push({
          id: `write-${p.type}`,
          group: "Write",
          lead: <span style={{ color: "var(--text-muted)", display: "flex" }}><IconEdit size={15} /></span>,
          title: `New doc from the ${p.name} pattern`,
          sub: "Starts with its section headings",
          run: () => go(writeHref({ type: p.type })),
        });
      }
    }
    return out;
  }, [query, results, recentDocs, spaces, currentUserId, spaceName, base, go, writeHref]);

  // Keep the keyboard-selected row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (items.length ? (a + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      // The editor listens for ⌘⏎ on the window to open Publish; inside the
      // palette it means "write", so it must not reach that listener.
      e.stopPropagation();
      const q = query.trim();
      go(writeHref(q ? { title: q } : {}));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[Math.min(active, items.length - 1)]?.run();
    }
  }

  let n = 0;
  const groups: Item["group"][] = ["Jump to", "Ask Aqli", "Write"];

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search, ask, or write">
        <div className="cmdk-in">
          <IconSearch size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Search, ask a question, or start writing…"
            aria-label="Search, ask a question, or start writing"
            autoComplete="off"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-l" ref={listRef} role="listbox">
          {groups.map((g) => {
            const inGroup = items.filter((i) => i.group === g);
            if (!inGroup.length) return null;
            return (
              <div key={g}>
                <div className="cg">{g}</div>
                {inGroup.map((item) => {
                  const idx = n++;
                  return (
                    <div
                      key={item.id}
                      data-i={idx}
                      role="option"
                      aria-selected={idx === active}
                      className={`ci${idx === active ? " is-on" : ""}`}
                      onMouseMove={() => setActive(idx)}
                      onClick={item.run}
                    >
                      <span style={{ display: "flex", width: 16, justifyContent: "center" }}>{item.lead}</span>
                      <span style={{ minWidth: 0 }}>
                        <b>{item.title}</b>
                        <em>{item.sub}</em>
                      </span>
                      <span className="kbd">↵</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="cmdk-f">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span className="kbd">↑↓</span> move
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span className="kbd">↵</span> open
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Status state="current" form="dot" /> Current
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Status state="ageing" form="dot" /> Ageing
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Status state="unverified" form="dot" /> Unverified
          </span>
        </div>
      </div>
    </div>
  );
}

/** Why this doc is in the list, in the same words the trust line uses. */
function describe(d: DocLite, me: string | null): string {
  if (!isPublished(d.status)) return `your draft · edited ${formatRelative(d.updated_at)}`;
  const pr = d.frontmatter?.source_pr_url?.match(/\/pull\/(\d+)/)?.[1];
  const state = docState(d);
  if (d.status === "review") return "waiting on a check";
  if (state === "unverified") {
    const who = d.owner_id === me ? "you" : null;
    return [who, pr ? `from PR #${pr}` : null, `edited ${formatRelative(d.updated_at)}`].filter(Boolean).join(" · ");
  }
  if (pr) return `from PR #${pr}`;
  return `checked ${formatRelative(d.last_reviewed_at ?? d.updated_at)}`;
}
