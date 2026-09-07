import { scoped } from "./scoped";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

/**
 * The write path (spec §3). Everything that changes a document goes through
 * `submitProposal`: humans, agents and the PR ingester alike.
 *
 * These are thin wrappers over the `app.*` functions. The logic lives in
 * Postgres because disposition and merge have to be one transaction — see
 * `supabase/migrations/20260805030000_merge_engine.sql`.
 */

/** Error codes the merge engine raises, mapped from Postgres SQLSTATEs. */
export type MergeErrorCode =
  | "proposal_not_open"
  | "stale_base"
  | "forbidden"
  | "document_not_found"
  | "space_not_found"
  | "agent_key_not_found";

const SQLSTATE_TO_CODE: Record<string, MergeErrorCode> = {
  P0001: "proposal_not_open",
  P0002: "stale_base",
  P0003: "forbidden",
  P0004: "document_not_found",
  P0005: "space_not_found",
  P0006: "agent_key_not_found",
};

const STATUS: Record<MergeErrorCode, number> = {
  proposal_not_open: 409,
  stale_base: 409,
  forbidden: 403,
  document_not_found: 404,
  space_not_found: 404,
  agent_key_not_found: 404,
};

export class MergeError extends Error {
  readonly code: MergeErrorCode;
  readonly status: number;

  constructor(code: MergeErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = "MergeError";
    this.code = code;
    this.status = STATUS[code];
  }
}

/**
 * A Postgres error out of PostgREST carries the raised SQLSTATE in `code` and
 * the message in `message`. Older PostgREST versions surface `P0001` for
 * everything raised without an explicit errcode, so the message is checked as
 * a fallback before giving up and rethrowing.
 */
function asMergeError(error: PostgrestError): unknown {
  const byState = SQLSTATE_TO_CODE[error.code ?? ""];
  if (byState) return new MergeError(byState, error);

  const byMessage = (Object.values(SQLSTATE_TO_CODE) as string[]).find(
    (c) => error.message === c,
  );
  if (byMessage) return new MergeError(byMessage as MergeErrorCode, error);

  return error;
}

/**
 * Control keys the merge engine reads out of `frontmatter` when a proposal
 * creates a document. `docs` has `type`, `status` and `agent_id` columns that
 * `proposals` does not, and this is the channel spec §3.2 already uses to
 * carry `doc_class`.
 */
export type ProposalControlKeys = {
  doc_class?: "canon" | "record";
  doc_type?: string;
  doc_status?: string;
  agent_id?: string;
  origin?: "human" | "agent" | "system";
};

export type SubmitInput = {
  workspaceId: string;
  title: string;
  bodyMd: string;
  spaceId?: string | null;
  /** Null creates a document; a uuid revises one. */
  documentId?: string | null;
  /**
   * The revision the author actually read. Omit for last-writer-wins, which
   * is what the editor's autosave has always done; pass it to get optimistic
   * concurrency and a `stale_base` when the document moved underneath.
   */
  baseRevisionId?: string | null;
  frontmatter?: Record<string, unknown> & ProposalControlKeys;
  /** Transitional: keeps `docs.body_json` in step with `body_md` until step 6. */
  bodyJson?: Record<string, unknown> | null;
  rationale?: string | null;
  authorId?: string | null;
  assistedBy?: string[];
  agentKeyId?: string | null;
  idempotencyKey?: string | null;
  /** Resets the staleness clock. The review path passes true; the editor does not. */
  markReviewed?: boolean;
  /**
   * Treat the actor as holding the `write` scope for this decision. The bridge
   * for the workspace-level `agent_auto_approve` setting, which predates
   * per-key scopes. `review_all` still queues.
   */
  trusted?: boolean;
};

export type SubmitResult = {
  proposalId: string;
  documentId: string | null;
  state: "open" | "merged" | "rejected" | "superseded";
  autoMerged: boolean;
  disposition: "merge" | "queue";
  /** True when an idempotency key replayed an earlier submit. */
  replayed: boolean;
};

/**
 * Anything that can run an RPC: the workspace-scoped service client, or the
 * request-scoped client bound to a signed-in user.
 *
 * Which one you pass is a security decision, not a convenience. Pass the
 * user's client for a human save and the merge engine sees their `auth.uid()`
 * and enforces membership itself. Pass the scoped service client only on the
 * agent path, where there is no session and the caller has already checked
 * that the key belongs to the workspace.
 */
export type RpcClient = Pick<SupabaseClient, "rpc">;

export async function submitProposal(
  input: SubmitInput,
  db: RpcClient = scoped(input.workspaceId),
): Promise<SubmitResult> {
  const { data, error } = await db.rpc("submit_proposal", {
    p_workspace_id: input.workspaceId,
    p_title: input.title,
    p_body_md: input.bodyMd,
    p_space_id: input.spaceId ?? null,
    p_document_id: input.documentId ?? null,
    p_base_revision_id: input.baseRevisionId ?? null,
    p_frontmatter: input.frontmatter ?? {},
    p_body_json: input.bodyJson ?? null,
    p_rationale: input.rationale ?? null,
    p_author_id: input.authorId ?? null,
    p_assisted_by: input.assistedBy ?? [],
    p_agent_key_id: input.agentKeyId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_mark_reviewed: input.markReviewed ?? false,
    p_trusted: input.trusted ?? false,
  });
  if (error) throw asMergeError(error);

  const r = data as {
    proposal_id: string;
    document_id: string | null;
    state: SubmitResult["state"];
    auto_merged: boolean;
    disposition: SubmitResult["disposition"];
    replayed: boolean;
  };
  return {
    proposalId: r.proposal_id,
    documentId: r.document_id,
    state: r.state,
    autoMerged: r.auto_merged,
    disposition: r.disposition,
    replayed: r.replayed,
  };
}

/** Apply an open proposal. Returns the document id it landed on. */
export async function mergeProposal(
  workspaceId: string,
  proposalId: string,
  opts: { actorId?: string | null; markReviewed?: boolean } = {},
  db: RpcClient = scoped(workspaceId),
): Promise<string> {
  const { data, error } = await db.rpc("merge_proposal", {
    p_proposal_id: proposalId,
    p_actor: opts.actorId ?? null,
    p_mark_reviewed: opts.markReviewed ?? false,
  });
  if (error) throw asMergeError(error);
  return data as string;
}

export async function rejectProposal(
  workspaceId: string,
  proposalId: string,
  opts: { actorId?: string | null; note?: string | null } = {},
  db: RpcClient = scoped(workspaceId),
): Promise<string> {
  const { data, error } = await db.rpc("reject_proposal", {
    p_proposal_id: proposalId,
    p_actor: opts.actorId ?? null,
    p_note: opts.note ?? null,
  });
  if (error) throw asMergeError(error);
  return data as string;
}
