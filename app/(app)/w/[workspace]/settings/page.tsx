import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import AppTopBar from "@/components/layout/AppTopBar";
import { SettingsHeader, SettingsCard, FormField, Input, Select } from "@/components/settings/primitives";

export default async function SettingsGeneralPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Workspace" }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <SettingsHeader
            title="Workspace"
            sub="The shared layer for your team's docs and agents. Settings here apply to every space and every agent in this workspace."
          />

          <SettingsCard title="Workspace name" sub="Shown in the sidebar and at the top of every doc.">
            <FormField label="Name">
              <Input value={workspace.name} />
            </FormField>
            <FormField label="URL slug" hint={`https://your-aqli.app/w/${workspace.slug}`}>
              <Input value={workspace.slug} mono />
            </FormField>
          </SettingsCard>

          <SettingsCard title="Defaults" sub="How new docs and agent output start out.">
            <FormField label="Default doc status for human authors">
              <Select value="Draft" />
            </FormField>
            <FormField label="Default doc status for agent authors" hint="Agent output should land here until a human approves it.">
              <Select value="Draft" pinned />
            </FormField>
            <FormField label="Stale doc threshold" hint="Docs not reviewed in this window are flagged stale.">
              <Select value="90 days" />
            </FormField>
          </SettingsCard>

          <SettingsCard title="AI provider" sub="Embeddings and AI features use this key. Bring your own.">
            <FormField label="OpenAI API key">
              <Input value="sk-••••••••••••••••••••••••a7c2" mono />
            </FormField>
            <FormField label="Embedding model">
              <Select value="text-embedding-3-small" mono />
            </FormField>
          </SettingsCard>
        </div>
      </div>
    </>
  );
}
