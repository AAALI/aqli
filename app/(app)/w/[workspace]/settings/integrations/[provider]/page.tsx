import { redirect } from "next/navigation";

// Hidden for MVP — integrations detail was mock-only.
export default async function HiddenProviderPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  redirect(`/w/${workspace}/settings`);
}
