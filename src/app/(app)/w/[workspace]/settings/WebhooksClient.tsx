"use client";

import { useState } from "react";

type Webhook = {
  id: string;
  url: string;
  events: string[];
  last_status: number | null;
  last_error: string | null;
  last_delivered_at: string | null;
};

/**
 * Where mentions and review requests go when they leave the app.
 *
 * Aqli has no mail transport, so the bell is the only delivery mechanism — and
 * a team that lives in chat will miss both. One HTTPS POST per event in a shape
 * Slack, Teams and Discord all accept is the small version of a fix, and the
 * one that does not need an OAuth flow with any of them (docs/adoption.md F-5).
 *
 * Loaded on demand: most workspaces have none, and a list nobody opened is a
 * query nobody needed.
 */
export default function WebhooksClient({
  workspaceId,
  isAdmin,
}: {
  workspaceId: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/webhooks?workspace_id=${workspaceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the endpoints");
      setWebhooks(data.webhooks as Webhook[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setWebhooks([]);
    }
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, url, events: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add that endpoint");
      setUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/webhooks?workspace_id=${workspaceId}&id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove that endpoint");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Notifications in chat</h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
        Mentions and review requests reach people through the bell in this app and nowhere else.
        Add an incoming-webhook URL from Slack, Teams or Discord and they will reach chat too.
        Titles and links only — never the contents of a document.
      </p>

      {!open ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setOpen(true);
            void load();
          }}
        >
          Set up
        </button>
      ) : (
        <>
          {error && (
            <p style={{ fontSize: 12.5, color: "var(--danger-fg, #b91c1c)", marginBottom: 10 }}>
              {error}
            </p>
          )}

          {webhooks === null ? (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {webhooks.map((hook) => (
                <div
                  key={hook.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13,
                    padding: "9px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--bg-card)",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {hook.url}
                  </span>
                  {/* The last attempt, so a wrong URL is visible here rather
                      than being something to infer from silence in chat. */}
                  {hook.last_error ? (
                    <span style={{ fontSize: 11.5, color: "var(--danger-fg, #b91c1c)" }}>
                      {hook.last_error}
                    </span>
                  ) : hook.last_delivered_at ? (
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Delivering</span>
                  ) : (
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Not used yet</span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => void remove(hook.id)}
                    style={{ height: 28, fontSize: 12 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="url"
              value={url}
              placeholder="https://hooks.slack.com/services/…"
              onChange={(e) => setUrl(e.target.value)}
              style={{
                flex: 1,
                fontSize: 13,
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-base)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={busy || !url.startsWith("https://")}
              onClick={() => void add()}
            >
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
