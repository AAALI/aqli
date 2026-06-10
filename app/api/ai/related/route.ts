import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { queryContext } from "@/lib/ai/context";

/**
 * Editor v2 "Related context" rail: given the passage the user is writing,
 * surface approved sections from *other* docs that line up with it.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspace_id, doc_id, text } = await req.json();
  if (!workspace_id || typeof text !== "string" || !text.trim())
    return NextResponse.json(
      { error: "workspace_id and text required" },
      { status: 400 },
    );

  try {
    const results = await queryContext(workspace_id, text.slice(0, 2000), {
      limit: 6,
      status: "approved",
    });
    return NextResponse.json({
      results: results
        .filter((r) => r.doc_id !== doc_id)
        .slice(0, 4)
        .map((r) => ({
          doc_id: r.doc_id,
          doc_title: r.doc_title,
          doc_type: r.doc_type,
          space: r.space,
          heading: r.heading,
          excerpt: r.content.length > 320 ? `${r.content.slice(0, 320)}…` : r.content,
          score: r.score,
        })),
    });
  } catch (err) {
    console.error("AI related failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch related context" },
      { status: 502 },
    );
  }
}
