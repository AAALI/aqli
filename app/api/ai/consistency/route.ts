import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { queryContext } from "@/lib/ai/context";

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ConsistencyHint = { level: "ok" | "warn"; text: string };

/**
 * Editor v2 consistency check: compare the draft against the workspace's
 * approved corpus for terminology drift, missing sections, and voice.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspace_id, doc_id, title, body_md } = await req.json();
  if (!workspace_id || typeof body_md !== "string" || body_md.trim().length < 80)
    return NextResponse.json(
      { error: "workspace_id and a draft of at least 80 characters required" },
      { status: 400 },
    );

  let corpus = "";
  try {
    const samples = (
      await queryContext(workspace_id, (title ?? body_md).slice(0, 1000), {
        limit: 4,
        status: "approved",
      })
    ).filter((r) => r.doc_id !== doc_id);
    corpus = samples
      .map((s) => `[${s.doc_title} — ${s.heading ?? "Overview"}]\n${s.content.slice(0, 600)}`)
      .join("\n\n---\n\n");
  } catch {
    // No corpus — still check internal consistency of the draft itself.
  }

  const prompt = `You are Aqli's consistency checker for the draft "${title ?? "Untitled"}".

Draft (markdown):
${body_md.slice(0, 8000)}

${corpus ? `Approved docs from the same workspace for comparison:\n${corpus}` : "No approved docs are available for comparison — check the draft's internal consistency only."}

Produce at most 4 hints as JSON: {"hints": [{"level": "ok" | "warn", "text": "…"}]}.
Check for:
1. The same concept named two different ways inside the draft (quote both terms).
2. Sections that comparable approved docs include but this draft is missing.
3. Whether the draft's voice matches the approved docs (one "ok" hint if it does).
Each hint is a single plain sentence. Only report what you can point to — no generic advice.`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    let hints: ConsistencyHint[] = [];
    try {
      const parsed = JSON.parse(raw) as { hints?: ConsistencyHint[] };
      hints = (parsed.hints ?? [])
        .filter(
          (h) =>
            (h.level === "ok" || h.level === "warn") &&
            typeof h.text === "string",
        )
        .slice(0, 4);
    } catch {
      // Malformed model output — return no hints rather than garbage.
    }
    return NextResponse.json({ hints });
  } catch (err) {
    console.error("AI consistency failed:", err);
    return NextResponse.json(
      { error: "Failed to run consistency check" },
      { status: 502 },
    );
  }
}
