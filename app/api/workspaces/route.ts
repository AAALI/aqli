import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createWorkspace, getMyWorkspaces } from "@/lib/supabase/workspaces";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { normalizeSlug, validateSlug } from "@/lib/onboarding/plan";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaces = await getMyWorkspaces();
  return NextResponse.json({ workspaces });
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
  if (!name)
    return NextResponse.json({ error: "name required" }, { status: 400 });

  const slug = normalizeSlug(body?.slug || name);
  const check = validateSlug(slug);
  if (!check.ok)
    return NextResponse.json({ error: check.reason, field: "slug" }, { status: 400 });

  try {
    const workspace = await createWorkspace(name, slug);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err) {
    // `workspaces.slug` is unique across the whole install, so a common name is
    // gone as soon as one team takes it. This used to escape as a 500, which
    // reached the user as "Could not create workspace" with no cause and no way
    // forward. There is deliberately no availability endpoint to check against
    // first: RLS hides other members' workspaces, so only the insert knows, and
    // an unscoped lookup would let any signed-in user enumerate every slug on
    // the install. The client turns this 409 into alternatives to pick from.
    if (isUniqueViolation(err, "workspaces_slug_key")) {
      return NextResponse.json(
        { error: `The URL "${slug}" is already taken.`, field: "slug", slug },
        { status: 409 },
      );
    }
    throw err;
  }
}
