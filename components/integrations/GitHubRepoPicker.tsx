"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevDown, IconCheck, IconSearch } from "@/components/aqli/icons";

type Repo = { full_name: string; private: boolean };
type Space = { id: string; name: string };

export default function GitHubRepoPicker({
  workspaceId,
  spaces,
  defaultSpaceId,
}: {
  workspaceId: string;
  spaces: Space[];
  defaultSpaceId: string;
}) {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [spaceId, setSpaceId] = useState(defaultSpaceId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/integrations/composio/repos?workspace_id=${workspaceId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!active) return;
        if (!r.ok) throw new Error(data.error ?? "Failed to load repositories");
        setRepos(data.repos ?? []);
        setSelected(new Set<string>(data.selected ?? []));
      })
      .catch((e) => active && setLoadError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setSaved(null);
  }

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch("/api/integrations/composio/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          repos: [...selected],
          default_space_id: spaceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      // Guard against variant payload shapes so a successful save isn't
      // reported as "Save failed" when `saved` is missing/not an array.
      const savedRepos: string[] = Array.isArray(data.saved) ? data.saved : [...selected];
      setSaved(
        data.error
          ? `Saved, but triggers failed: ${data.error}`
          : `Saved — watching ${savedRepos.length} ${savedRepos.length === 1 ? "repo" : "repos"}.`,
      );
      router.refresh();
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filtered = query
    ? repos.filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()))
    : repos;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Repositories</span>

        <div ref={panelRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={loading || !!loadError}
            style={{
              ...controlStyle,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", cursor: loading ? "default" : "pointer",
            }}
          >
            <span style={{ color: selected.size ? "var(--text-primary)" : "var(--text-muted)" }}>
              {loading
                ? "Loading repositories…"
                : loadError
                  ? loadError
                  : selected.size === 0
                    ? "Select repositories to watch"
                    : `${selected.size} ${selected.size === 1 ? "repo" : "repos"} selected`}
            </span>
            <IconChevDown size={14} />
          </button>

          {open && !loading && !loadError && (
            <div style={dropdownStyle}>
              <div style={{ padding: 8, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--text-muted)", display: "flex" }}><IconSearch size={14} /></span>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter repositories…"
                  style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, color: "var(--text-primary)" }}
                />
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto", padding: 4 }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--text-muted)" }}>No repositories match.</div>
                ) : (
                  filtered.map((repo) => {
                    const checked = selected.has(repo.full_name);
                    return (
                      <button
                        key={repo.full_name}
                        type="button"
                        onClick={() => toggle(repo.full_name)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "7px 8px", borderRadius: 6, border: 0, background: "transparent",
                          cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left",
                          fontFamily: "var(--font-sans)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
                          background: checked ? "var(--accent)" : "transparent",
                          color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {checked && <IconCheck size={11} sw={2.4} />}
                        </span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {repo.full_name}
                        </span>
                        {repo.private && (
                          <span style={{ fontSize: 10.5, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "0 5px" }}>private</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.4 }}>
          Composio creates one pull-request trigger per selected repo.
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Default destination space</span>
        <select value={spaceId} onChange={(e) => { setSpaceId(e.target.value); setSaved(null); }} style={controlStyle}>
          {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.4 }}>
          Used when a merged PR does not match an existing Linear-linked doc.
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" className="btn btn-primary" style={{ width: "fit-content" }} onClick={save} disabled={saving || loading}>
          {saving ? "Saving…" : "Save repositories"}
        </button>
        {saved && <span style={{ fontSize: 12.5, color: saved.startsWith("Saved") ? "var(--approved-text)" : "#993C1D" }}>{saved}</span>}
      </div>
    </div>
  );
}

const controlStyle: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "var(--font-sans)",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: 42,
  left: 0,
  right: 0,
  zIndex: 60,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
};
