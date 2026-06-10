import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { queryContext } from "@/lib/ai/context";
import { getPostHogClient } from "@/lib/posthog-server";

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, workspace_id } = await req.json();
  if (!question || !workspace_id)
    return NextResponse.json(
      { error: "question and workspace_id required" },
      { status: 400 },
    );

  // Retrieve relevant context from approved docs only.
  const contextResults = await queryContext(workspace_id, question, {
    limit: 5,
    status: "approved",
  });

  if (contextResults.length === 0) {
    return NextResponse.json({
      answer:
        "No relevant approved docs found for this question. Try approving more docs or rephrasing your question.",
      sources: [],
    });
  }

  const contextText = contextResults
    .map(
      (r, i) =>
        `[Source ${i + 1}: ${r.doc_title} — ${r.heading ?? "Overview"}]\n${r.content}`,
    )
    .join("\n\n---\n\n");

  const prompt = `You are Aqli, a knowledge assistant for an internal team knowledge base.
Answer the following question using ONLY the context provided below.
If the context does not contain enough information to answer, say so clearly.
Always cite which source(s) you used.

Context:
${contextText}

Question: ${question}

Answer concisely and accurately. At the end, list the sources you used as: "Sources: [Source 1], [Source 2]"`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.2,
    });
    const answer =
      response.choices[0]?.message?.content ?? "Unable to generate answer.";

    getPostHogClient().capture({
      distinctId: user.id,
      event: "ai_question_asked",
      properties: { workspace_id, sources_count: contextResults.length },
    });

    return NextResponse.json({
      answer,
      sources: contextResults.map((r) => ({
        doc_id: r.doc_id,
        doc_title: r.doc_title,
        heading: r.heading,
        source_url: r.source_url,
        score: r.score,
      })),
    });
  } catch (err) {
    console.error("AI ask failed:", err);
    return NextResponse.json(
      { error: "Failed to generate answer" },
      { status: 502 },
    );
  }
}
