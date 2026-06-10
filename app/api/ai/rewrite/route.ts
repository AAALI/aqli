import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { queryContext } from "@/lib/ai/context";
import { getPostHogClient } from "@/lib/posthog-server";

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type RewriteAction = "tighten" | "expand" | "match_voice";

const ACTION_INSTRUCTIONS: Record<RewriteAction, string> = {
  tighten:
    "Tighten the passage: cut filler, prefer active voice, keep every fact. Aim for roughly two-thirds of the original length.",
  expand:
    "Expand the passage with one or two sentences of clarifying detail that follow naturally from what is written. Do not invent specific numbers, names, or decisions that are not implied.",
  match_voice:
    "Rewrite the passage so its tone and phrasing match the voice of the team's approved docs (samples provided). Keep the meaning and all facts identical.",
};

/**
 * Editor v2 selection toolbar: rewrite the selected passage in place.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspace_id, action, text, doc_title } = await req.json();
  if (
    !workspace_id ||
    typeof text !== "string" ||
    !text.trim() ||
    !["tighten", "expand", "match_voice"].includes(action)
  )
    return NextResponse.json(
      { error: "workspace_id, text and a valid action required" },
      { status: 400 },
    );

  let voiceSamples = "";
  if (action === "match_voice") {
    try {
      const samples = await queryContext(
        workspace_id,
        `${doc_title ?? ""} ${text}`.slice(0, 1500),
        { limit: 3, status: "approved" },
      );
      if (samples.length > 0) {
        voiceSamples =
          "\n\nVoice samples from approved docs:\n" +
          samples.map((s) => `---\n${s.content.slice(0, 500)}`).join("\n");
      }
    } catch {
      // No approved corpus yet — fall back to a generic style pass.
    }
  }

  const prompt = `You are Aqli's co-writing assistant editing a passage inside the doc "${doc_title ?? "Untitled"}".
${ACTION_INSTRUCTIONS[action as RewriteAction]}${voiceSamples}

Passage:
${text}

Reply with ONLY the rewritten passage — no preamble, no quotes around it. Preserve inline markdown (bold, code, links) where it still applies.`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.3,
    });
    const rewritten = response.choices[0]?.message?.content?.trim();
    if (!rewritten)
      return NextResponse.json(
        { error: "Unable to rewrite passage" },
        { status: 502 },
      );

    getPostHogClient().capture({
      distinctId: user.id,
      event: "ai_rewrite_applied",
      properties: { workspace_id, action, chars: text.length },
    });

    return NextResponse.json({ text: rewritten });
  } catch (err) {
    console.error("AI rewrite failed:", err);
    return NextResponse.json(
      { error: "Failed to rewrite passage" },
      { status: 502 },
    );
  }
}
