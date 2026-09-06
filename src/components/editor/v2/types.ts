export type RelatedResult = {
  doc_id: string;
  doc_title: string;
  doc_type: string;
  space: string;
  heading: string | null;
  excerpt: string;
  score: number;
};

export type CowriteMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: { doc_id: string; doc_title: string; heading: string | null }[];
};

/**
 * Children of the editor register keyboard handlers here; the editor's
 * handleKeyDown runs them first and stops if one consumes the event.
 */
export type KeyHandlerRegistry = {
  register: (handler: (event: KeyboardEvent) => boolean) => () => void;
};
