"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Connect GitHub by pasting a personal access token.
 *
 * This is what replaced the Composio OAuth button. It is plainly a worse first
 * impression than a consent screen, and it is the honest trade for dropping a
 * 294 KiB SDK and a second vendor — so the form says exactly which scopes are
 * needed and links to the page that creates one, rather than leaving someone
 * to guess and get a 404 from GitHub that reads like the repo does not exist.
 */
export default function GitHubTokenForm({
  workspaceId,
  connected,
}: {
  workspaceId: string;
  connected: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!connected);

  async function submit() {
    const value = token.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, token: value }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        login?: string;
      };
      if (!res.ok) {
        setError(payload.error ?? "Could not connect GitHub.");
        return;
      }
      // Never leave a token sitting in component state once it is stored.
      setToken("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (connected && !open) {
    return (
      <button
        className="btn btn-secondary"
        style={{ width: "fit-content" }}
        onClick={() => setOpen(true)}
      >
        Replace token
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 520 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
          GitHub personal access token
        </span>
        <input
          type="password"
          value={token}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_… or github_pat_…"
          style={{
            padding: "9px 12px",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
      </label>

      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        Needs <strong style={{ fontWeight: 500 }}>repo</strong> to read pull requests and{" "}
        <strong style={{ fontWeight: 500 }}>admin:repo_hook</strong> to subscribe to merges.{" "}
        <a
          href="https://github.com/settings/tokens/new?scopes=repo,admin:repo_hook&description=Aqli"
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: "var(--accent)" }}
        >
          Create one on GitHub
        </a>
        . It is stored server-side and never shown again.
      </p>

      {error && (
        <span style={{ fontSize: 12, color: "var(--stale-text)", lineHeight: 1.5 }}>{error}</span>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={busy || token.trim().length === 0}
          style={{ width: "fit-content" }}
        >
          {busy ? "Checking…" : connected ? "Save token" : "Connect GitHub"}
        </button>
        {connected && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setToken("");
              setError(null);
              setOpen(false);
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
