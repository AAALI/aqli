import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";
import type { ContextResult } from "@/types/chunk";

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type SearchRow = {
  doc_id: string;
  doc_title: string;
  doc_type: string;
  doc_status: string;
  space_name: string | null;
  heading: string | null;
  content: string;
  similarity: number;
  last_reviewed_at: string | null;
};

export async function queryContext(
  workspaceId: string,
  query: string,
  options?: {
    limit?: number;
    spaceSlug?: string;
    docType?: string;
    // Defaults to 'approved' — agents should not act on unreviewed content.
    status?: string;
  },
): Promise<ContextResult[]> {
  const limit = options?.limit ?? 5;
  const status = options?.status ?? "approved";

  // Embed the query.
  const openai = getOpenAI();
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  const supabase = createServiceClient();
  const [{ data, error }, { data: workspace }] = await Promise.all([
    supabase.rpc("search_doc_chunks", {
      query_embedding: queryEmbedding,
      workspace_id_param: workspaceId,
      status_param: status,
      match_count: limit,
      space_slug_param: options?.spaceSlug ?? null,
      doc_type_param: options?.docType ?? null,
    }),
    supabase.from("workspaces").select("slug").eq("id", workspaceId).single(),
  ]);

  if (error) throw error;

  // Docs live under /w/{workspace}/docs/{id} — an unprefixed /docs/{id} 404s.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const docBase = workspace?.slug
    ? `${appUrl}/w/${workspace.slug}/docs`
    : `${appUrl}/docs`;
  return ((data ?? []) as SearchRow[]).map((row): ContextResult => ({
    doc_id: row.doc_id,
    doc_title: row.doc_title,
    doc_type: row.doc_type,
    doc_status: row.doc_status,
    space: row.space_name ?? "Unknown",
    heading: row.heading,
    content: row.content,
    score: row.similarity,
    source_url: `${docBase}/${row.doc_id}${
      row.heading ? `#${row.heading.toLowerCase().replace(/\s+/g, "-")}` : ""
    }`,
    last_reviewed_at: row.last_reviewed_at,
  }));
}
