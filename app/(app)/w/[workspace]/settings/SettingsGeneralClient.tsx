"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsHeader, SettingsCard, FormField } from "@/components/settings/primitives";
import type { Workspace } from "@/types/workspace";

const STALE_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 },
];

const inputStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 36,
  padding: "0 12px",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontFamily: "var(--font-sans)",
  fontSize: 13.5,
  color: "var(--text-primary)",
  width: "100%",
  outline: "none",
};

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 32,
};

type Settings = {
  stale_days?: number;
  openai_key?: string;
};

export default function SettingsGeneralClient({
  workspace,
  isAdmin,
}: {
  workspace: Workspace;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const settings = (workspace.settings ?? {}) as Settings;

  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [staleDays, setStaleDays] = useState(settings.stale_days ?? 90);
  const [openaiKey, setOpenaiKey] = useState(settings.openai_key ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugChanged = slug !== workspace.slug;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          settings: {
            stale_days: staleDays,
            ...(openaiKey ? { openai_key: openaiKey } : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save settings");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (slugChanged && data.workspace?.slug) {
        router.push(`/w/${data.workspace.slug}/settings`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <SettingsHeader
        title="Workspace"
        sub="The shared layer for your team's docs and agents. Settings here apply to every space and every agent in this workspace."
        action={
          isAdmin ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {error && (
                <span style={{ fontSize: 12.5, color: "#993C1D" }}>{error}</span>
              )}
              {saved && (
                <span style={{ fontSize: 12.5, color: "var(--approved-text)" }}>Saved</span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ height: 34, fontSize: 13 }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          ) : null
        }
      />

      <SettingsCard title="Workspace name" sub="Shown in the sidebar and at the top of every doc.">
        <FormField label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            required
            style={inputStyle}
          />
        </FormField>
        <FormField
          label="URL slug"
          hint={`https://your-aqli.app/w/${slug}${slugChanged ? " — changing the slug will redirect you." : ""}`}
        >
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            disabled={!isAdmin}
            required
            style={monoInputStyle}
          />
        </FormField>
      </SettingsCard>

      <SettingsCard title="Defaults" sub="How new docs and agent output start out.">
        <FormField label="Default doc status for human authors">
          <div style={{ ...selectStyle, background: "var(--bg-base)", fontSize: 13.5, color: "var(--text-muted)" }}>
            Draft <span style={{ fontSize: 11.5, marginLeft: 6 }}>(fixed — humans start in draft)</span>
          </div>
        </FormField>
        <FormField label="Default doc status for agent authors" hint="Agent output starts as a draft until a human approves it.">
          <div style={{ ...selectStyle, background: "var(--bg-base)", fontSize: 13.5, color: "var(--text-muted)" }}>
            Draft <span style={{ fontSize: 11.5, marginLeft: 6 }}>(fixed — agents start in draft)</span>
          </div>
        </FormField>
        <FormField label="Stale doc threshold" hint="Approved docs not re-verified within this window are flagged stale.">
          <select
            value={staleDays}
            onChange={(e) => setStaleDays(Number(e.target.value))}
            disabled={!isAdmin}
            style={selectStyle}
          >
            {STALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
      </SettingsCard>

      <SettingsCard title="AI provider" sub="Embeddings and AI features use this key. Your key is stored encrypted and never logged.">
        <FormField label="OpenAI API key" hint="Used for embeddings and AI question answering. Leave blank to disable AI features.">
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            disabled={!isAdmin}
            placeholder={settings.openai_key ? "sk-••••••••••••••••" : "sk-..."}
            autoComplete="off"
            style={monoInputStyle}
          />
        </FormField>
        <FormField label="Embedding model">
          <div style={{ ...selectStyle, background: "var(--bg-base)", fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            text-embedding-3-small <span style={{ fontSize: 11.5, marginLeft: 6, fontFamily: "var(--font-sans)" }}>(fixed)</span>
          </div>
        </FormField>
      </SettingsCard>

      {!isAdmin && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", textAlign: "center", paddingTop: 8 }}>
          Only workspace admins can change these settings.
        </p>
      )}
    </form>
  );
}
