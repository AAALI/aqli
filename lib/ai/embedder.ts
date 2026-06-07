import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";
import { chunkMarkdown } from "./chunker";
import type { Doc } from "@/types/doc";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function resolveSpaceName(spaceId: string | null): Promise<string> {
  if (!spaceId) return "Unknown";
  const supabase = createServiceClient();
  const { data } = await supabase.from("spaces").select("name").eq("id", spaceId).single();
  return data?.name ?? "Unknown";
}

/**
 * Embed a doc: chunk it, embed each chunk, replace its rows in doc_chunks.
 * Called (fire-and-forget) after every save where body_md changes.
 * Uses the service-role client so it works from both human and agent paths.
 */
export async function embedDoc(doc: Doc, spaceName?: string): Promise<void> {
  const supabase = createServiceClient();

  if (!doc.body_md || doc.body_md.trim().length < 20) {
    // Too short to be worth embedding — clear any stale chunks.
    await supabase.from("doc_chunks").delete().eq("doc_id", doc.id);
    return;
  }

  const resolvedSpace = spaceName ?? (await resolveSpaceName(doc.space_id));

  const chunks = chunkMarkdown(doc.body_md, doc.title, doc.type, resolvedSpace, doc.status);
  if (chunks.length === 0) {
    await supabase.from("doc_chunks").delete().eq("doc_id", doc.id);
    return;
  }

  // Batch-embed all chunks in one API call.
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks.map((c) => c.content),
  });

  const vectors = embeddingResponse.data.map((e, i) => ({
    doc_id: doc.id,
    workspace_id: doc.workspace_id,
    chunk_index: chunks[i].index,
    heading: chunks[i].heading,
    content: chunks[i].content,
    token_count: chunks[i].content.split(/\s+/).length,
    embedding: e.embedding,
  }));

  // Replace old chunks atomically-ish: delete then insert.
  await supabase.from("doc_chunks").delete().eq("doc_id", doc.id);
  const { error } = await supabase.from("doc_chunks").insert(vectors);
  if (error) throw error;
}
