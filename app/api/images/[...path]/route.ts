import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { DOC_IMAGE_BUCKET } from "@/lib/doc-images";

/**
 * Serve a doc image.
 *
 * This route is the reason `body_md` can hold a plain, permanent
 * `![alt](/api/images/…)` link: the bucket is private, and access is decided
 * here, per request, against current workspace membership. Revoking someone
 * takes effect on their next image load rather than whenever a signed URL
 * happened to expire.
 *
 * The path is `<workspace_id>/<doc_id>/<file>`, matching the Storage RLS
 * policies.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const [workspaceId] = path;

  if (!workspaceId || path.length < 3) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await getMyRole(workspaceId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase.storage
    .from(DOC_IMAGE_BUCKET)
    .download(path.join("/"));

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Length": String(data.size),
      // Private: the response depends on who is asking, so a shared cache must
      // never hold it. The short max-age keeps a doc full of screenshots from
      // re-downloading on every scroll.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Served from the app's own origin, so a file that turns out to be
      // interpretable gets no privileges even if it is opened directly.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
