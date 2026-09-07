/**
 * The MCP tool surface.
 *
 * Six tools, deliberately. Every tool definition is sent to the model on every
 * turn, so a wide surface is a standing tax on every conversation an assistant
 * has — which is the reason this file should resist growing. Each tool is a
 * thin wrapper over a module the REST agent API already uses: no new data
 * paths, no second implementation of the write rules.
 *
 * Dependencies arrive as `ToolDeps` rather than imports. Two reasons: the
 * dispatch rules (scope gating, argument coercion, error mapping) become
 * testable without a database, and this module keeps the service-role client
 * out of its own import graph.
 */
import type { AgentScope } from "@/lib/merge/disposition";
import type { DocStatus, DocType } from "@/types/doc";
import { DOC_STATUSES, DOC_TYPES } from "@/types/doc";

export type ToolContext = {
  workspaceId: string;
  keyId: string;
  scopes: AgentScope[];
  /**
   * The member this key acts for. Every read below passes it, because that is
   * the rule that keeps an assistant's answers leak-free: a private space its
   * owner is not in is not in its results (docs/adoption.md F-4).
   */
  ownerUserId: string | null;
};

/** Injected at the route. Types are structural so tests can pass fakes. */
export type ToolDeps = {
  queryContext: (
    workspaceId: string,
    query: string,
    options?: {
      limit?: number;
      spaceSlug?: string;
      docType?: string;
      status?: string;
      viewerId?: string | null;
    },
  ) => Promise<
    {
      doc_id: string;
      doc_title: string;
      doc_type: string;
      space: string;
      heading: string | null;
      content: string;
      score: number;
      source_url: string;
      last_reviewed_at: string | null;
    }[]
  >;
  listAgentDocs: (
    workspaceId: string,
    opts: {
      type?: DocType;
      status?: DocStatus;
      limit: number;
      offset: number;
      parentId?: string | "root";
      viewerId?: string | null;
    },
  ) => Promise<{
    docs: {
      id: string;
      title: string;
      type: string;
      status: string;
      updated_at: string;
      parent_doc_id?: string | null;
      space: { slug: string; name: string } | null;
      frontmatter?: { tags?: string[] } | null;
    }[];
    total: number;
  }>;
  getAgentDoc: (
    workspaceId: string,
    id: string,
    viewerId?: string | null,
  ) => Promise<{
    id: string;
    workspace_id: string;
    title: string;
    type: string;
    status: string;
    body_md: string | null;
    agent_id: string | null;
    current_revision_id: string | null;
    last_reviewed_at: string | null;
    updated_at: string;
    parent_doc_id?: string | null;
    frontmatter: { tags?: string[] } | null;
    space: { slug: string; name: string } | null;
  } | null>;
  /**
   * Announce an event to the workspace's chat webhooks, if it has any.
   * Optional: a deployment with none configured passes nothing, and the tools
   * behave exactly as before.
   */
  notifyWebhooks?: (
    workspaceId: string,
    input: {
      type: "mention" | "review_requested";
      text: string;
      docId: string;
      docTitle: string;
      actorName: string | null;
    },
  ) => Promise<void>;
  /** How many sub-pages hang off a document. A count, not the pages: read_doc must stay one document. */
  countChildDocs: (workspaceId: string, docId: string, viewerId?: string | null) => Promise<number>;
  proposeAgentDoc: (input: {
    workspaceId: string;
    agentKeyId?: string | null;
    documentId?: string | null;
    spaceId?: string | null;
    baseRevisionId?: string | null;
    title: string;
    bodyMd: string;
    type?: DocType;
    status?: DocStatus;
    agentId?: string;
    parentId?: string | null;
    frontmatter?: { tags: string[] };
    rationale?: string | null;
    idempotencyKey?: string | null;
    trusted?: boolean;
    markReviewed?: boolean;
  }) => Promise<{
    proposalId: string;
    state: string;
    doc: { id: string; workspace_id: string; status: string; agent_id: string | null; body_md: string | null; updated_at: string; current_revision_id: string | null } | null;
  }>;
  setAgentDocStatus: (
    workspaceId: string,
    id: string,
    status: DocStatus,
  ) => Promise<unknown>;
  getSpaceBySlug: (
    workspaceId: string,
    slug: string,
  ) => Promise<{ id: string; name: string; slug: string } | null>;
  getWorkspaceMeta: (workspaceId: string) => Promise<{
    agentAutoApprove: boolean;
    docUrl: (docId: string) => string;
  }>;
  logActivity: (input: {
    docId: string;
    workspaceId: string;
    /** Everything this module logs is an agent acting; the key is the actor. */
    actorType: "agent";
    actorId: string | null;
    actorName: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  embedDoc: (doc: unknown, spaceName?: string) => Promise<void>;
  /** Raised by the merge engine; compared with `instanceof`. */
  MergeError: new (...args: never[]) => Error & { code: string; status: number };
};

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

type JsonSchema = Record<string, unknown>;

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** The scope a key must hold. `read` is on every key by construction. */
  requires: AgentScope;
};

/**
 * A key holding `write` may obviously also propose. `read` is implied
 * everywhere: `normalizeScopes` guarantees it.
 */
function hasScope(scopes: AgentScope[], required: AgentScope): boolean {
  if (required === "read") return true;
  if (required === "propose") return scopes.includes("propose") || scopes.includes("write");
  return scopes.includes(required);
}

const PROPOSAL_CONTRACT =
  "Writes are proposals, not publishes: depending on the space's review policy " +
  "this either lands as a new revision or queues for a person to approve. Never " +
  "tell the user a doc is published unless the result says it merged.";

export const TOOLS: ToolDefinition[] = [
  {
    name: "search_docs",
    description:
      "Search the company knowledge base by meaning and return the passages that answer a " +
      "question, with the document each came from. Use this before answering anything about " +
      "company policy, process, decisions, or how something is done here. Searches approved " +
      "documents only by default — approved means a person reviewed it.",
    requires: "read",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A question or topic in natural language." },
        space: { type: "string", description: "Restrict to one space by its slug, e.g. 'marketing'." },
        type: { type: "string", enum: DOC_TYPES, description: "Restrict to one document type." },
        status: {
          type: "string",
          enum: DOC_STATUSES,
          description:
            "Defaults to 'approved'. Widen only when the user explicitly asks about drafts.",
        },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "Passages to return (default 5)." },
      },
      required: ["query"],
    },
  },
  {
    name: "list_docs",
    description:
      "List documents newest-first, to see what exists rather than to answer a question. " +
      "Use search_docs to answer questions. Pass parent_id to walk the page tree one level " +
      "at a time, or parent_id='root' for the top level of every space.",
    requires: "read",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: DOC_TYPES },
        status: { type: "string", enum: DOC_STATUSES },
        parent_id: {
          type: "string",
          description:
            "A document id to list the sub-pages of, or 'root' for documents with no parent.",
        },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Default 20." },
        offset: { type: "integer", minimum: 0 },
      },
    },
  },
  {
    name: "read_doc",
    description:
      "Read one document in full as markdown, by id. Use after search_docs when the passages " +
      "are not enough, or before propose_update so the edit is based on current content. " +
      "Returns parent_id and child_count; call list_docs with parent_id to read the sub-pages.",
    requires: "read",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Document id (uuid)." } },
      required: ["id"],
    },
  },
  {
    name: "propose_doc",
    description:
      `Create a new document from markdown. ${PROPOSAL_CONTRACT} Include on_behalf_of so the ` +
      "review queue shows who asked for it.",
    requires: "propose",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body_md: {
          type: "string",
          description:
            "The document body in markdown. Mermaid diagrams work inside ```mermaid fences. " +
            "Do not repeat the title as a top-level heading.",
        },
        space: { type: "string", description: "Space slug. Ask the user rather than guessing." },
        parent_id: {
          type: "string",
          description:
            "Create this as a sub-page of that document. It inherits the parent's space, so " +
            "the space argument is unnecessary when this is set.",
        },
        type: { type: "string", enum: DOC_TYPES, description: "Default 'general'." },
        tags: { type: "array", items: { type: "string" } },
        note: { type: "string", description: "Why this document is being created — shown to the reviewer." },
        on_behalf_of: {
          type: "string",
          description: "The person who asked for this, e.g. their name or email.",
        },
        idempotency_key: {
          type: "string",
          description: "Pass a stable key when retrying so a retry replays instead of duplicating.",
        },
      },
      required: ["title", "body_md"],
    },
  },
  {
    name: "propose_update",
    description:
      `Revise an existing document by replacing its markdown body. ${PROPOSAL_CONTRACT} ` +
      "Read the document first and pass base_revision_id so a concurrent edit is caught " +
      "instead of silently overwritten.",
    requires: "propose",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document id (uuid)." },
        body_md: { type: "string", description: "The complete new body. This replaces the old one." },
        title: { type: "string", description: "Only when the title itself should change." },
        base_revision_id: {
          type: "string",
          description: "The revision_id returned by read_doc. Enables conflict detection.",
        },
        note: { type: "string", description: "What changed and why — shown to the reviewer." },
        on_behalf_of: { type: "string", description: "The person who asked for this change." },
        idempotency_key: { type: "string" },
      },
      required: ["id", "body_md"],
    },
  },
  {
    name: "request_review",
    description:
      "Flag a document for human attention, putting it in the review queue. Use when a " +
      "document looks wrong, stale, or contradicts something else.",
    requires: "propose",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document id (uuid)." },
        note: { type: "string", description: "Why it needs review." },
      },
      required: ["id"],
    },
  },
];

/** Thrown for a bad argument; the caller turns it into an isError result. */
export class ToolInputError extends Error {}

function args(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function requireString(a: Record<string, unknown>, key: string): string {
  const v = a[key];
  if (typeof v !== "string" || v.trim() === "") {
    throw new ToolInputError(`"${key}" is required and must be a non-empty string.`);
  }
  return v;
}

function optString(a: Record<string, unknown>, key: string): string | undefined {
  const v = a[key];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") throw new ToolInputError(`"${key}" must be a string.`);
  return v;
}

function optInt(
  a: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const v = a[key];
  if (v === undefined || v === null) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new ToolInputError(`"${key}" must be a number.`);
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function optEnum<T extends string>(
  a: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const v = optString(a, key);
  if (v === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(v)) {
    throw new ToolInputError(`"${key}" must be one of: ${allowed.join(", ")}.`);
  }
  return v as T;
}

function optTags(a: Record<string, unknown>): string[] {
  const v = a.tags;
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((t) => typeof t !== "string")) {
    throw new ToolInputError('"tags" must be an array of strings.');
  }
  return v as string[];
}

function text(value: unknown): ToolResult {
  return {
    content: [
      { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
    ],
  };
}

function failure(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Who asked, in one line the reviewer will actually read.
 *
 * `on_behalf_of` does not go into `agent_id`: that column names the
 * integration, and conflating it with a person would make the AI-activity log
 * lie about which key acted. The rationale is the field that survives a queued
 * proposal, so the human belongs there.
 */
function rationale(note: string | undefined, onBehalfOf: string | undefined): string | null {
  const parts = [note, onBehalfOf ? `Requested by ${onBehalfOf}.` : undefined].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length ? parts.join("\n\n") : null;
}

export async function dispatchTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
  deps: ToolDeps,
): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    return failure(`Unknown tool "${name}". Available: ${TOOLS.map((t) => t.name).join(", ")}.`);
  }
  if (!hasScope(ctx.scopes, tool.requires)) {
    // The database decides merge-vs-queue but never refuses, so a read-only
    // key would otherwise be able to queue proposals — which is not what
    // `DEFAULT_AGENT_SCOPES` promises. Refuse here, and name the scope so
    // whoever holds the key knows what to change.
    return failure(
      `This API key is not allowed to call "${name}": it needs the "${tool.requires}" scope ` +
        `but has [${ctx.scopes.join(", ")}]. A workspace admin can change the key's scopes in ` +
        `Settings → API keys.`,
    );
  }

  const a = args(rawArgs);

  try {
    switch (name) {
      case "search_docs": {
        const results = await deps.queryContext(ctx.workspaceId, requireString(a, "query"), {
          viewerId: ctx.ownerUserId,
          limit: optInt(a, "limit", 5, 1, 20),
          spaceSlug: optString(a, "space"),
          docType: optEnum(a, "type", DOC_TYPES),
          status: optEnum(a, "status", DOC_STATUSES) ?? "approved",
        });
        if (results.length === 0) {
          return text(
            "No matching documents. The knowledge base may not cover this yet — say so " +
              "rather than answering from memory.",
          );
        }
        return text({
          passages: results.map((r) => ({
            doc_id: r.doc_id,
            title: r.doc_title,
            space: r.space,
            heading: r.heading,
            excerpt: r.content,
            url: r.source_url,
            last_reviewed_at: r.last_reviewed_at,
          })),
        });
      }

      case "list_docs": {
        const limit = optInt(a, "limit", 20, 1, 100);
        const offset = optInt(a, "offset", 0, 0, Number.MAX_SAFE_INTEGER);
        const [{ docs, total }, workspace] = await Promise.all([
          deps.listAgentDocs(ctx.workspaceId, {
            type: optEnum(a, "type", DOC_TYPES),
            status: optEnum(a, "status", DOC_STATUSES),
            parentId: optString(a, "parent_id"),
            viewerId: ctx.ownerUserId,
            limit,
            offset,
          }),
          deps.getWorkspaceMeta(ctx.workspaceId),
        ]);
        return text({
          docs: docs.map((d) => ({
            id: d.id,
            title: d.title,
            type: d.type,
            status: d.status,
            space: d.space?.slug ?? null,
            parent_id: d.parent_doc_id ?? null,
            tags: d.frontmatter?.tags ?? [],
            updated_at: d.updated_at,
            url: workspace.docUrl(d.id),
          })),
          total,
          has_more: offset + docs.length < total,
        });
      }

      case "read_doc": {
        const id = requireString(a, "id");
        const [doc, workspace] = await Promise.all([
          deps.getAgentDoc(ctx.workspaceId, id, ctx.ownerUserId),
          deps.getWorkspaceMeta(ctx.workspaceId),
        ]);
        // A document in a space this key's owner cannot read reports as absent,
        // not as forbidden: "you may not see this" confirms it exists.
        if (!doc) return failure(`No document with id "${id}" in this workspace.`);
        const childCount = await deps.countChildDocs(ctx.workspaceId, doc.id, ctx.ownerUserId);
        return text({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          status: doc.status,
          space: doc.space?.slug ?? null,
          parent_id: doc.parent_doc_id ?? null,
          child_count: childCount,
          tags: doc.frontmatter?.tags ?? [],
          body_md: doc.body_md ?? "",
          // Pass this back to propose_update to get conflict detection.
          revision_id: doc.current_revision_id,
          last_reviewed_at: doc.last_reviewed_at,
          updated_at: doc.updated_at,
          url: workspace.docUrl(doc.id),
        });
      }

      case "propose_doc": {
        const title = requireString(a, "title");
        const bodyMd = requireString(a, "body_md");
        const spaceSlug = optString(a, "space");
        const workspace = await deps.getWorkspaceMeta(ctx.workspaceId);

        let spaceId: string | null = null;
        let spaceName = "Unknown";
        if (spaceSlug) {
          const space = await deps.getSpaceBySlug(ctx.workspaceId, spaceSlug);
          if (!space) {
            return failure(
              `No space with slug "${spaceSlug}". Call list_docs to see which spaces exist.`,
            );
          }
          spaceId = space.id;
          spaceName = space.name;
        }

        const autoApprove = workspace.agentAutoApprove;
        const result = await deps.proposeAgentDoc({
          workspaceId: ctx.workspaceId,
          agentKeyId: ctx.keyId,
          spaceId,
          // Placement is validated by the database: a parent in another
          // workspace, one that would close a loop, or one already eight levels
          // deep is refused there rather than trusted from here.
          parentId: optString(a, "parent_id") ?? null,
          title,
          bodyMd,
          type: optEnum(a, "type", DOC_TYPES) ?? "general",
          status: autoApprove ? "approved" : "draft",
          // Names the integration, not the person. Which MCP client this was
          // is carried by the key, which has a name and an owner; `on_behalf_of`
          // carries the human. See `rationale` above.
          agentId: "mcp",
          frontmatter: { tags: optTags(a) },
          rationale: rationale(optString(a, "note"), optString(a, "on_behalf_of")),
          idempotencyKey: optString(a, "idempotency_key") ?? null,
          trusted: autoApprove,
          markReviewed: autoApprove,
        });

        if (!result.doc) {
          // The event a pilot actually stalls on: something is waiting for a
          // person, and the person is not in the app today (docs/adoption.md F-5).
          await deps.notifyWebhooks?.(ctx.workspaceId, {
            type: "review_requested",
            text: "An assistant proposed a new document",
            docId: result.proposalId,
            docTitle: title,
            actorName: "mcp",
          });

          return text({
            outcome: "queued_for_review",
            proposal_id: result.proposalId,
            message:
              "Submitted for human review. No document exists yet — it appears once a " +
              "reviewer approves it.",
          });
        }

        const doc = result.doc;
        await deps.logActivity({
          docId: doc.id,
          workspaceId: doc.workspace_id,
          actorType: "agent",
          actorId: doc.agent_id,
          actorName: doc.agent_id,
          action: "created",
          metadata: {
            proposal_id: result.proposalId,
            via: "mcp",
            on_behalf_of: optString(a, "on_behalf_of") ?? null,
            to_status: doc.status,
            ...(autoApprove ? { auto_approved: true, reason: "workspace_policy" } : {}),
          },
        });
        if (doc.body_md) {
          // A failed embed must not fail the call: the document exists, and an
          // error here makes a well-behaved agent retry and duplicate it.
          await deps
            .embedDoc(doc, spaceName)
            .catch((err) => console.error("Embed failed for MCP doc", doc.id, err));
        }

        return text({
          outcome: "created",
          id: doc.id,
          status: doc.status,
          proposal_id: result.proposalId,
          url: workspace.docUrl(doc.id),
        });
      }

      case "propose_update": {
        const id = requireString(a, "id");
        const bodyMd = requireString(a, "body_md");
        const existing = await deps.getAgentDoc(ctx.workspaceId, id, ctx.ownerUserId);
        if (!existing) return failure(`No document with id "${id}" in this workspace.`);

        const workspace = await deps.getWorkspaceMeta(ctx.workspaceId);
        let result;
        try {
          result = await deps.proposeAgentDoc({
            workspaceId: ctx.workspaceId,
            agentKeyId: ctx.keyId,
            documentId: id,
            baseRevisionId: optString(a, "base_revision_id") ?? null,
            title: optString(a, "title") ?? existing.title,
            bodyMd,
            frontmatter: { tags: existing.frontmatter?.tags ?? [] },
            rationale: rationale(optString(a, "note"), optString(a, "on_behalf_of")),
            idempotencyKey: optString(a, "idempotency_key") ?? null,
            trusted: workspace.agentAutoApprove,
          });
        } catch (err) {
          if (err instanceof deps.MergeError) {
            if (err.code === "stale_base") {
              return failure(
                "This document changed since you read it, so the edit was not applied. " +
                  `Call read_doc("${id}") again, re-apply the change to the current text, ` +
                  `and retry with the new revision_id (was ${existing.current_revision_id}).`,
              );
            }
            return failure(`The edit was rejected: ${err.code}.`);
          }
          throw err;
        }

        if (!result.doc) {
          return text({
            outcome: "queued_for_review",
            proposal_id: result.proposalId,
            message:
              "Submitted for human review. The document is unchanged until a reviewer " +
              "approves the change.",
          });
        }

        const doc = result.doc;
        if (doc.body_md) {
          await deps
            .embedDoc(doc, existing.space?.name)
            .catch((err) => console.error("Embed failed for MCP doc", doc.id, err));
        }
        return text({
          outcome: "updated",
          id: doc.id,
          revision_id: doc.current_revision_id,
          proposal_id: result.proposalId,
          updated_at: doc.updated_at,
          url: workspace.docUrl(doc.id),
        });
      }

      case "request_review": {
        const id = requireString(a, "id");
        const doc = await deps.getAgentDoc(ctx.workspaceId, id, ctx.ownerUserId);
        if (!doc) return failure(`No document with id "${id}" in this workspace.`);

        await deps.setAgentDocStatus(ctx.workspaceId, id, "review");
        await deps.logActivity({
          docId: id,
          workspaceId: doc.workspace_id,
          actorType: "agent",
          actorId: doc.agent_id,
          actorName: doc.agent_id,
          action: "review_requested",
          metadata: {
            via: "mcp",
            note: optString(a, "note") ?? null,
            from_status: doc.status,
            to_status: "review",
          },
        });

        await deps.notifyWebhooks?.(ctx.workspaceId, {
          type: "review_requested",
          text: `${doc.agent_id ?? "An assistant"} asked for review`,
          docId: id,
          docTitle: doc.title,
          actorName: doc.agent_id,
        });

        const workspace = await deps.getWorkspaceMeta(ctx.workspaceId);
        return text({
          outcome: "review_requested",
          id,
          message:
            "Flagged for human review. It will not re-enter trusted context until a person " +
            "approves it.",
          url: workspace.docUrl(id),
        });
      }

      default:
        return failure(`Tool "${name}" is defined but not implemented.`);
    }
  } catch (err) {
    if (err instanceof ToolInputError) return failure(err.message);
    throw err;
  }
}
