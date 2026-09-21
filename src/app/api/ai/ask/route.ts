import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { queryContext } from "@/lib/ai/context";
import { getPostHogClient } from "@/lib/posthog-server";
import { recordQuestion, answerAdmitsGap } from "@/lib/supabase/questions";
import { docState, type DocState, type Stateful } from "@/lib/doc-status";

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

  // queryContext runs on the service-role client (bypasses RLS), so verify
  // the caller actually belongs to the workspace they're querying.
  const role = await getMyRole(workspace_id);
  if (!role)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Retrieve relevant context from approved docs only.
  const contextResults = await queryContext(workspace_id, question, {
    limit: 5,
    status: "approved",
    // Ask answers from what this person can read. A private space they are not
    // in is not in the answer, and not in the sources under it.
    viewerId: user.id,
  });

  if (contextResults.length === 0) {
    // Recorded unanswered: this is what Home and Search surface as a gap.
    await recordQuestion(workspace_id, question, null);
    return NextResponse.json({
      answer: "Nobody has written this down yet.",
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

    // A retrieval hit is not an answer if the model says the passages do
    // not cover it — that still counts as a gap.
    await recordQuestion(
      workspace_id,
      question,
      answerAdmitsGap(answer) ? null : contextResults[0].doc_id,
    );

    getPostHogClient().capture({
      distinctId: user.id,
      event: "ai_question_asked",
      properties: { workspace_id, sources_count: contextResults.length },
    });

    // Each source carries the same state every other surface shows for it,
    // so "Because" under an answer says how far to trust it.
    const ids = [...new Set(contextResults.map((r) => r.doc_id))];
    const { data: rows } = await supabase
      .from("docs")
      .select("id, last_reviewed_at, updated_at, frontmatter")
      .in("id", ids);
    const states = new Map<string, DocState>(
      ((rows ?? []) as (Stateful & { id: string })[]).map(
        (d) => [d.id, docState(d)],
      ),
    );

    return NextResponse.json({
      answer,
      sources: contextResults.map((r) => ({
        doc_id: r.doc_id,
        doc_title: r.doc_title,
        heading: r.heading,
        source_url: r.source_url,
        score: r.score,
        state: states.get(r.doc_id) ?? "unverified",
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
