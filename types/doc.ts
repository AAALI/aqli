import type { Space } from "./space";

export type DocType =
  | "prd"
  | "adr"
  | "runbook"
  | "fix_note"
  | "compliance"
  | "decision"
  | "general";

export type DocStatus = "draft" | "review" | "approved" | "stale" | "archived";

export type AuthorType = "human" | "agent";

export type DocFrontmatter = {
  tags: string[];
  linked_project_url?: string;
  linear_project_id?: string;
};

export type Doc = {
  id: string;
  workspace_id: string;
  space_id: string | null;
  title: string;
  type: DocType;
  status: DocStatus;
  owner_id: string | null;
  author_type: AuthorType;
  agent_id: string | null;
  body_json: Record<string, unknown> | null; // Tiptap JSON
  body_md: string | null;
  frontmatter: DocFrontmatter;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocVersion = {
  id: string;
  doc_id: string;
  version_number: number;
  body_md: string;
  frontmatter: DocFrontmatter | null;
  changed_by: string | null;
  change_type: "edit" | "status_change" | "created";
  created_at: string;
};

export type DocWithSpace = Doc & {
  space: Space | null;
};

export const DOC_TYPES: DocType[] = [
  "prd",
  "adr",
  "runbook",
  "fix_note",
  "compliance",
  "decision",
  "general",
];

export const DOC_STATUSES: DocStatus[] = [
  "draft",
  "review",
  "approved",
  "stale",
  "archived",
];
