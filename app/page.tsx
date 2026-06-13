import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyWorkspaces } from "@/lib/supabase/workspaces";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const workspaces = await getMyWorkspaces();
    if (workspaces.length === 0) redirect("/signup?step=workspace");
    redirect(`/w/${workspaces[0].slug}`);
  }

  return <LandingPage />;
}
