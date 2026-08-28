import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { workspaceExport } from "@/lib/export/db";
import { zipStream } from "@/lib/export/zip-writer";

/**
 * Download the whole workspace as markdown and images.
 *
 * The exit door, and the reason it is a route rather than a script: everyone
 * leaving a proprietary wiki has just learned what lock-in costs and will ask.
 * "Markdown is canonical, so an export is lossless" is half an answer until
 * there is a button.
 *
 * Streamed, so a large workspace never exists in memory as one value.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slug = new URL(req.url).searchParams.get("workspace");
  if (!slug) return NextResponse.json({ error: "workspace is required" }, { status: 400 });

  const workspace = await getWorkspaceBySlug(slug).catch(() => null);
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The export is every document in the workspace, including spaces a member
  // may not have opened. That is an admin's call.
  const role = await getMyRole(workspace.id);
  if (role !== "admin") {
    return NextResponse.json({ error: "Only workspace admins can export" }, { status: 403 });
  }

  const files = await workspaceExport(workspace.id);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(zipStream(files) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${workspace.slug}-${date}.zip"`,
      // The archive is deterministic, but what it contains is not: a cached
      // copy would be last week's workspace.
      "Cache-Control": "no-store",
    },
  });
}
