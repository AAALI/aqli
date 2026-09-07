import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import {
  DOC_IMAGE_BUCKET,
  docImageObjectPath,
  docImageRejection,
  docImageUrl,
} from "@/lib/doc-images";

/**
 * Upload one image for a doc.
 *
 * Multipart: `file`, `workspace_id`, `doc_id`. Returns the URL to write into
 * the markdown.
 *
 * The upload goes through the request-scoped (RLS-respecting) client, so the
 * Storage policies added in `20260806010000_doc_images_storage.sql` are the
 * real authority on who may write where. The membership check here is the
 * early, legible failure — not the security boundary.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  const workspaceId = form.get("workspace_id");
  const docId = form.get("doc_id");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (typeof workspaceId !== "string" || typeof docId !== "string") {
    return NextResponse.json(
      { error: "workspace_id and doc_id required" },
      { status: 400 },
    );
  }

  const rejection = docImageRejection(file);
  if (rejection) return NextResponse.json({ error: rejection }, { status: 400 });

  if (!(await getMyRole(workspaceId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // The doc must be in the workspace the path claims, or an image could be
  // filed under a workspace the caller belongs to while pointing at someone
  // else's document.
  const { data: doc } = await supabase
    .from("docs")
    .select("id")
    .eq("id", docId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Doc not found" }, { status: 404 });

  const objectPath = docImageObjectPath(workspaceId, docId, file.type);
  const { error } = await supabase.storage
    .from(DOC_IMAGE_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("Image upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      url: docImageUrl(objectPath),
      // The original filename never reaches the object path, but it is the
      // best alt text available without asking, and the editor lets it be
      // edited afterwards.
      alt: file.name.replace(/\.[^.]+$/, "").slice(0, 120),
    },
    { status: 201 },
  );
}
