"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsHeader, SettingsCard, FormField } from "@/components/settings/primitives";
import type { Workspace } from "@/types/workspace";


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

export default function SettingsGeneralClient({
  workspace,
  isAdmin,
  aiConfigured,
}: {
  workspace: Pick<Workspace, "id" | "name" | "slug">;
  isAdmin: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);

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
                <span style={{ fontSize: 12.5, color: "var(--ok-text)" }}>Saved</span>
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


      <SettingsCard title="AI provider" sub="AI features use the OpenAI key configured by whoever runs this installation, not a workspace setting.">
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {aiConfigured ? "An OpenAI key is configured for this installation." : "No OpenAI key is configured for this installation."}{" "}
          To enable or disable AI features, ask your deployment administrator to set or remove{" "}
          <code>OPENAI_API_KEY</code> in the server environment and redeploy.
        </p>
        <FormField label="Embedding model">
          <div style={{ ...monoInputStyle, color: "var(--text-secondary)" }}>
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
