import { redirect } from "next/navigation";

export default async function AgentsSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/w/${workspace}/agent-log`);
}
