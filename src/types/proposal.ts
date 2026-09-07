import type { DocClass, DocFrontmatter } from "./doc";
import type { Space } from "./space";

/**
 * The universal write path (spec §2.2). Humans, agents and the PR ingester all
 * land here first; the space's review policy decides whether the write merges
 * straight away or waits for a person.
 */
export type ProposalState = "open" | "merged" | "rejected" | "superseded";

/** What an agent key is allowed to do (spec §2.1). */
export type AgentScope = "read" | "propose" | "write";

export type ReviewPolicy = "open" | "review_agents" | "review_all";

/**
 * Control keys the merge engine reads out of a proposal's frontmatter when the
 * proposal creates a document. `docs` has columns `proposals` does not, and
 * this is the channel spec §3.2 already uses to carry `doc_class`.
 */
export type ProposalControlFrontmatter = DocFrontmatter & {
  doc_class?: DocClass;
  doc_type?: string;
  doc_status?: string;
  agent_id?: string;
  origin?: "human" | "agent" | "system";
};

export type Proposal = {
  id: string;
  workspace_id: string;
  space_id: string | null;
  /** Null means the proposal creates a document rather than revising one. */
  document_id: string | null;
  base_revision_id: string | null;
  title: string;
  body_md: string;
  /** Transitional Tiptap cache; retired by the step-6 canonical flip. */
  body_json: Record<string, unknown> | null;
  frontmatter: ProposalControlFrontmatter;
  rationale: string | null;
  author_id: string | null;
  assisted_by: string[];
  agent_key_id: string | null;
  state: ProposalState;
  auto_merged: boolean;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  idempotency_key: string | null;
  created_at: string;
};

/** Append-only history. One row per merged change (spec §2.2). */
export type Revision = {
  id: string;
  document_id: string;
  workspace_id: string;
  seq: number;
  title: string;
  body_md: string;
  frontmatter: DocFrontmatter;
  author_id: string | null;
  assisted_by: string[];
  agent_key_id: string | null;
  parent_revision_id: string | null;
  proposal_id: string | null;
  created_at: string;
};

/** A queue row: the proposal plus enough context to review it without a click. */
export type ProposalWithContext = Proposal & {
  space: Pick<Space, "id" | "name" | "slug" | "icon"> | null;
  document: {
    id: string;
    title: string;
    body_md: string | null;
    type: string;
    status: string;
    current_revision_id: string | null;
  } | null;
  agent_key: { id: string; name: string } | null;
};
