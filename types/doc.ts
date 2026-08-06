import type { Space } from "./space";

export type DocType =
  | "general"
  | "how_to"
  | "policy"
  | "meeting"
  | "brief"
  | "decision"
  | "prd"
  | "adr"
  | "runbook"
  | "fix_note"
  | "compliance";

export type DocStatus = "draft" | "review" | "approved" | "stale" | "archived";

export type AuthorType = "human" | "agent";

/** `canon` = living document, `record` = immutable event (spec §2.1). */
export type DocClass = "canon" | "record";

/** Supersedes `author_type`; `system` covers the PR ingester and importers. */
export type DocOrigin = "human" | "agent" | "system";

export type DocFrontmatter = {
  tags: string[];
  linked_project_url?: string;
  linear_project_id?: string;
  linear_issue_id?: string;
  source_pr_url?: string;
  source_repo?: string;
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

  // Added by the markdown-canonical migration (spec §2.2). `body_text` and
  // `headings` are search inputs derived from `body_md` by a database trigger
  // and are never rendered.
  doc_class: DocClass;
  origin: DocOrigin;
  source_ref: Record<string, unknown> | null;
  body_text: string;
  headings: string;
  current_revision_id: string | null;
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
  "general",
  "how_to",
  "policy",
  "meeting",
  "brief",
  "decision",
  "prd",
  "adr",
  "runbook",
  "fix_note",
  "compliance",
];

export const DOC_STATUSES: DocStatus[] = [
  "draft",
  "review",
  "approved",
  "stale",
  "archived",
];
