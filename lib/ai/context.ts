import OpenAI from "openai";
import { scoped } from "@/lib/db";
import { blockedSpaceIds } from "@/lib/spaces/visibility";
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
    /**
     * Who is asking. Retrieval runs on the service role, so RLS does not apply
     * — this is what keeps a private space out of an answer (ADOPTION.md F-4).
     * Null means a member of nothing: open spaces only.
     */
    viewerId?: string | null;
  },
): Promise<ContextResult[]> {
  const limit = options?.limit ?? 5;
  const status = options?.status ?? "approved";

  const blocked = await blockedSpaceIds(workspaceId, options?.viewerId ?? null);
  // Over-fetch when something is hidden, so filtering a passage out does not
  // silently shorten the answer for everyone who has a private space.
  const matchCount = blocked.length > 0 ? Math.min(limit * 4, 40) : limit;

  // Embed the query.
  const openai = getOpenAI();
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  const supabase = scoped(workspaceId);
  const [{ data, error }, { data: workspace }] = await Promise.all([
    supabase.rpc("search_doc_chunks", {
      query_embedding: queryEmbedding,
      workspace_id_param: workspaceId,
      status_param: status,
      match_count: matchCount,
      space_slug_param: options?.spaceSlug ?? null,
      doc_type_param: options?.docType ?? null,
    }),
    supabase.from("workspaces").select("slug").single(),
  ]);

  if (error) throw error;

  // Docs live under /w/{workspace}/docs/{id} — an unprefixed /docs/{id} 404s.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const docBase = workspace?.slug
    ? `${appUrl}/w/${workspace.slug}/docs`
    : `${appUrl}/docs`;
  let rows = (data ?? []) as SearchRow[];

  if (blocked.length > 0) {
    // The search function returns a space *name*, which is not an id and not
    // reliably unique. Resolve the documents it matched and drop the ones in a
    // space this viewer cannot open — before anything is quoted back to them.
    const ids = [...new Set(rows.map((row) => row.doc_id))];
    const { data: docs } = await supabase.from("docs").select("id, space_id").in("id", ids);
    const spaceById = new Map(
      ((docs ?? []) as { id: string; space_id: string | null }[]).map((d) => [d.id, d.space_id]),
    );
    rows = rows.filter((row) => {
      const spaceId = spaceById.get(row.doc_id) ?? null;
      return !spaceId || !blocked.includes(spaceId);
    });
  }

  return rows.slice(0, limit).map((row): ContextResult => ({
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
