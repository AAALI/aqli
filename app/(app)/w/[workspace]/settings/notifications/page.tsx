import { redirect } from "next/navigation";

// Hidden for MVP — this surface was mock-only. Redirect to settings overview
// until the real feature ships.
export default async function HiddenSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/w/${workspace}/settings`);
}
