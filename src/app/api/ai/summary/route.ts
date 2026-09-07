import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import { typeLabel } from "@/lib/doc-display";

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { doc_id } = await req.json();
  if (!doc_id)
    return NextResponse.json({ error: "doc_id required" }, { status: 400 });

  const doc = await getDoc(doc_id).catch(() => null);
  if (!doc)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.body_md)
    return NextResponse.json(
      { error: "Doc has no content to summarise" },
      { status: 400 },
    );

  const prompt = `You are summarising an internal team document for Aqli, a knowledge base.

Document type: ${typeLabel(doc.type)}
Document title: ${doc.title}
Document status: ${doc.status}

Content:
${doc.body_md.slice(0, 4000)}

Write a concise summary in 3-5 sentences. Focus on:
1. What this document is about
2. The key decision, requirement, or finding
3. Who should read it and why

Write in plain English. No bullet points. No headings. Just clear prose.`;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    });
    const summary =
      response.choices[0]?.message?.content ?? "Unable to generate summary.";
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("AI summary failed:", err);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 502 },
    );
  }
}
