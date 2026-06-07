export type DocChunk = {
  id: string;
  doc_id: string;
  workspace_id: string;
  chunk_index: number;
  heading: string | null;
  content: string;
  token_count: number | null;
  embedding: number[] | null;
  created_at: string;
};

export type ContextResult = {
  doc_id: string;
  doc_title: string;
  doc_type: string;
  doc_status: string;
  space: string;
  heading: string | null;
  content: string;
  score: number;
  source_url: string;
  last_reviewed_at: string | null;
};
