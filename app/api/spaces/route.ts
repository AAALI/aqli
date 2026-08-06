import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSpaces, createSpace } from "@/lib/supabase/spaces";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  const spaces = await getSpaces(workspaceId);
  return NextResponse.json({ spaces });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!body?.workspace_id || !name)
    return NextResponse.json(
      { error: "workspace_id and name required" },
      { status: 400 },
    );

  const slug = slugify(body.slug ?? name);
  if (!slug)
    return NextResponse.json(
      { error: "name must contain a letter or number" },
      { status: 400 },
    );

  try {
    const space = await createSpace({
      workspace_id: body.workspace_id,
      name,
      slug,
      icon: body.icon,
    });
    return NextResponse.json({ space }, { status: 201 });
  } catch (err) {
    // Spaces are unique on (workspace_id, slug). Re-running onboarding, or
    // picking a name that differs only in case from an existing space, lands
    // here — which is a no-op from the caller's point of view, not a failure.
    if (isUniqueViolation(err, "spaces_workspace_id_slug_key")) {
      return NextResponse.json(
        { error: `A space at "${slug}" already exists.`, field: "name", slug },
        { status: 409 },
      );
    }
    throw err;
  }
}
