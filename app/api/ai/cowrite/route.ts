import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { queryContext } from "@/lib/ai/context";
import { getPostHogClient } from "@/lib/posthog-server";

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Editor v2 Co-write chat: a drafting agent grounded in the current doc and
 * the workspace's approved corpus. The user approves every insertion.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspace_id, doc_id, title, body_md, messages } = await req.json();
  if (!workspace_id || !Array.isArray(messages) || messages.length === 0)
    return NextResponse.json(
      { error: "workspace_id and messages required" },
      { status: 400 },
    );

  const chat = (messages as ChatMessage[])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-10);
  const lastUser = [...chat].reverse().find((m) => m.role === "user");
  if (!lastUser)
    return NextResponse.json(
      { error: "A user message is required" },
      { status: 400 },
    );

  // Ground the agent in approved docs relevant to the request + draft.
  let sources: Awaited<ReturnType<typeof queryContext>> = [];
  try {
    sources = (
      await queryContext(
        workspace_id,
        `${title ?? ""}\n${lastUser.content}`.slice(0, 1500),
        { limit: 5, status: "approved" },
      )
    ).filter((r) => r.doc_id !== doc_id);
  } catch {
    // Empty corpus is fine — the agent works from the draft alone.
  }

  const contextText =
    sources.length > 0
      ? sources
          .map(
            (r, i) =>
              `[Source ${i + 1}: ${r.doc_title} — ${r.heading ?? "Overview"}]\n${r.content}`,
          )
          .join("\n\n---\n\n")
      : "(no approved docs matched)";

  const system = `You are Co-write, Aqli's drafting agent inside the doc editor. You help the author draft, tighten, and cite — they approve every change before it lands.

Current draft: "${title ?? "Untitled"}"
---
${(body_md ?? "").slice(0, 6000) || "(empty so far)"}
---

Approved context from other docs in this workspace:
${contextText}

Rules:
- When asked to draft a section, reply with ready-to-insert markdown (start with a "## Heading" when drafting a whole section). No preamble like "Here's a draft" — the markdown body only, optionally followed by one short note prefixed with "> Note:".
- Ground claims in the draft or the approved context. If neither covers it, say what's missing instead of inventing specifics.
- When you use an approved source, cite it by title in the text.
- Match the voice of the approved context: plain, direct, engineering-grade prose.
- Keep conversational answers short.`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: system }, ...chat],
      max_tokens: 900,
      temperature: 0.4,
    });
    const reply = response.choices[0]?.message?.content?.trim();
    if (!reply)
      return NextResponse.json(
        { error: "Unable to generate reply" },
        { status: 502 },
      );

    getPostHogClient().capture({
      distinctId: user.id,
      event: "ai_cowrite_message",
      properties: { workspace_id, doc_id, sources_count: sources.length },
    });

    return NextResponse.json({
      reply,
      sources: sources.map((r) => ({
        doc_id: r.doc_id,
        doc_title: r.doc_title,
        heading: r.heading,
      })),
    });
  } catch (err) {
    console.error("AI cowrite failed:", err);
    return NextResponse.json(
      { error: "Failed to generate reply" },
      { status: 502 },
    );
  }
}
