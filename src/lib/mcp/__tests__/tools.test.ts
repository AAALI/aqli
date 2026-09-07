import { describe, expect, it, vi } from "vitest";
import { TOOLS, dispatchTool, type ToolContext, type ToolDeps } from "../tools";

class FakeMergeError extends Error {
  constructor(
    readonly code: string,
    readonly status = 409,
  ) {
    super(code);
  }
}

function makeDeps(overrides: Partial<ToolDeps> = {}): ToolDeps {
  return {
    queryContext: vi.fn().mockResolvedValue([]),
    listAgentDocs: vi.fn().mockResolvedValue({ docs: [], total: 0 }),
    getAgentDoc: vi.fn().mockResolvedValue(null),
    countChildDocs: vi.fn().mockResolvedValue(0),
    proposeAgentDoc: vi.fn().mockResolvedValue({ proposalId: "p1", state: "queued", doc: null }),
    setAgentDocStatus: vi.fn().mockResolvedValue({}),
    getSpaceBySlug: vi.fn().mockResolvedValue(null),
    getWorkspaceMeta: vi.fn().mockResolvedValue({
      agentAutoApprove: false,
      docUrl: (id: string) => `https://aqli.test/w/tab/docs/${id}`,
    }),
    logActivity: vi.fn().mockResolvedValue(undefined),
    embedDoc: vi.fn().mockResolvedValue(undefined),
    MergeError: FakeMergeError as unknown as ToolDeps["MergeError"],
    ...overrides,
  };
}

const ctx = (scopes: ToolContext["scopes"], ownerUserId: string | null = "owner-1"): ToolContext => ({
  workspaceId: "ws1",
  keyId: "key1",
  scopes,
  ownerUserId,
});

/** Tool results carry JSON in a text block; parse it back to assert on it. */
function payload(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

describe("the tool surface", () => {
  it("stays small — a wide surface taxes every conversation", () => {
    expect(TOOLS).toHaveLength(6);
  });

  it("has unique names and a declared scope per tool", () => {
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length);
    for (const tool of TOOLS) {
      expect(["read", "propose", "write"]).toContain(tool.requires);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description.length).toBeGreaterThan(40);
    }
  });

  it("tells the model that a write is a proposal, on every write tool", () => {
    for (const tool of TOOLS.filter((t) => t.requires === "propose")) {
      expect(tool.description).toMatch(/proposal|review/i);
    }
  });
});

describe("scope gating", () => {
  it.each(["propose_doc", "propose_update", "request_review"])(
    "refuses %s for a read-only key and names the missing scope",
    async (name) => {
      const result = await dispatchTool(
        name,
        { id: "d1", title: "t", body_md: "b" },
        ctx(["read"]),
        makeDeps(),
      );
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('"propose" scope');
      expect(result.content[0].text).toContain("[read]");
    },
  );

  it("allows the read tools for a read-only key", async () => {
    const result = await dispatchTool("list_docs", {}, ctx(["read"]), makeDeps());
    expect(result.isError).toBeUndefined();
  });

  it("lets a write-scoped key propose — write implies propose", async () => {
    const deps = makeDeps();
    const result = await dispatchTool(
      "propose_doc",
      { title: "T", body_md: "body" },
      ctx(["read", "write"]),
      deps,
    );
    expect(result.isError).toBeUndefined();
    expect(deps.proposeAgentDoc).toHaveBeenCalled();
  });

  it("rejects an unknown tool by name", async () => {
    const result = await dispatchTool("drop_database", {}, ctx(["read", "write"]), makeDeps());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
  });
});

describe("search_docs", () => {
  it("searches approved docs by default and returns passages with urls", async () => {
    const deps = makeDeps({
      queryContext: vi.fn().mockResolvedValue([
        {
          doc_id: "d1",
          doc_title: "Leave policy",
          doc_type: "policy",
          space: "People",
          heading: "Parental leave",
          content: "Sixteen weeks.",
          score: 0.9,
          source_url: "https://aqli.test/w/tab/docs/d1#parental-leave",
          last_reviewed_at: "2026-08-01T00:00:00Z",
        },
      ]),
    });

    const result = await dispatchTool("search_docs", { query: "parental leave" }, ctx(["read"]), deps);

    expect(deps.queryContext).toHaveBeenCalledWith("ws1", "parental leave", {
      limit: 5,
      spaceSlug: undefined,
      docType: undefined,
      status: "approved",
      viewerId: "owner-1",
    });
    expect(payload(result).passages[0]).toMatchObject({
      doc_id: "d1",
      title: "Leave policy",
      url: "https://aqli.test/w/tab/docs/d1#parental-leave",
    });
  });

  it("passes space, type and a clamped limit through", async () => {
    const deps = makeDeps();
    await dispatchTool(
      "search_docs",
      { query: "q", space: "marketing", type: "policy", limit: 999 },
      ctx(["read"]),
      deps,
    );
    expect(deps.queryContext).toHaveBeenCalledWith("ws1", "q", {
      limit: 20,
      spaceSlug: "marketing",
      docType: "policy",
      status: "approved",
      viewerId: "owner-1",
    });
  });

  it("says the knowledge base is silent rather than returning nothing", async () => {
    const result = await dispatchTool("search_docs", { query: "x" }, ctx(["read"]), makeDeps());
    expect(result.content[0].text).toMatch(/rather than answering from memory/);
  });

  it("requires a query", async () => {
    const result = await dispatchTool("search_docs", {}, ctx(["read"]), makeDeps());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"query" is required');
  });

  it("rejects a doc type that is not in the enum", async () => {
    const result = await dispatchTool(
      "search_docs",
      { query: "q", type: "invoice" },
      ctx(["read"]),
      makeDeps(),
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"type" must be one of');
  });
});

describe("read_doc", () => {
  it("returns the body and the revision to base an edit on", async () => {
    const deps = makeDeps({
      getAgentDoc: vi.fn().mockResolvedValue({
        id: "d1",
        workspace_id: "ws1",
        title: "Runbook",
        type: "runbook",
        status: "approved",
        body_md: "# steps",
        agent_id: null,
        current_revision_id: "rev9",
        last_reviewed_at: null,
        updated_at: "2026-08-01T00:00:00Z",
        frontmatter: { tags: ["ops"] },
        space: { slug: "operations", name: "Operations" },
      }),
    });
    const result = await dispatchTool("read_doc", { id: "d1" }, ctx(["read"]), deps);
    expect(payload(result)).toMatchObject({
      id: "d1",
      body_md: "# steps",
      revision_id: "rev9",
      space: "operations",
      tags: ["ops"],
    });
  });

  it("reports a missing document instead of throwing", async () => {
    const result = await dispatchTool("read_doc", { id: "nope" }, ctx(["read"]), makeDeps());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No document with id");
  });
});

describe("the page tree", () => {
  it("list_docs passes parent_id through, so an agent can walk one level at a time", async () => {
    const listAgentDocs = vi.fn().mockResolvedValue({ docs: [], total: 0 });
    await dispatchTool("list_docs", { parent_id: "doc-1" }, ctx(["read"]), makeDeps({ listAgentDocs }));
    expect(listAgentDocs).toHaveBeenCalledWith("ws1", expect.objectContaining({ parentId: "doc-1" }));

    await dispatchTool("list_docs", { parent_id: "root" }, ctx(["read"]), makeDeps({ listAgentDocs }));
    expect(listAgentDocs).toHaveBeenLastCalledWith("ws1", expect.objectContaining({ parentId: "root" }));
  });

  it("list_docs reports each document's parent", async () => {
    const listAgentDocs = vi.fn().mockResolvedValue({
      docs: [
        { id: "d1", title: "Leave", type: "policy", status: "approved", updated_at: "2026-08-01", parent_doc_id: "d0", space: null },
      ],
      total: 1,
    });
    const result = await dispatchTool("list_docs", {}, ctx(["read"]), makeDeps({ listAgentDocs }));
    expect(payload(result).docs[0].parent_id).toBe("d0");
  });

  it("read_doc returns the parent and how many sub-pages there are, not the sub-pages", async () => {
    // A read_doc that inlined children would put an unbounded amount of text
    // in front of a model that asked for one document.
    const deps = makeDeps({
      getAgentDoc: vi.fn().mockResolvedValue({
        id: "d1",
        workspace_id: "ws1",
        title: "Benefits",
        type: "policy",
        status: "approved",
        body_md: "# Benefits",
        agent_id: null,
        current_revision_id: "r1",
        last_reviewed_at: null,
        updated_at: "2026-08-01",
        parent_doc_id: null,
        frontmatter: { tags: [] },
        space: { slug: "handbook", name: "Handbook" },
      }),
      countChildDocs: vi.fn().mockResolvedValue(6),
    });
    const result = await dispatchTool("read_doc", { id: "d1" }, ctx(["read"]), deps);
    const body = payload(result);
    expect(body.parent_id).toBeNull();
    expect(body.child_count).toBe(6);
    expect(body).not.toHaveProperty("children");
  });

  it("propose_doc places a new document under a parent", async () => {
    const proposeAgentDoc = vi
      .fn()
      .mockResolvedValue({ proposalId: "p1", state: "queued", doc: null });
    await dispatchTool(
      "propose_doc",
      { title: "Parental leave", body_md: "text", parent_id: "d1" },
      ctx(["read", "propose"]),
      makeDeps({ proposeAgentDoc }),
    );
    expect(proposeAgentDoc).toHaveBeenCalledWith(expect.objectContaining({ parentId: "d1" }));
  });

  it("propose_doc without a parent asks for none, rather than guessing at one", async () => {
    const proposeAgentDoc = vi
      .fn()
      .mockResolvedValue({ proposalId: "p1", state: "queued", doc: null });
    await dispatchTool(
      "propose_doc",
      { title: "Standalone", body_md: "text" },
      ctx(["read", "propose"]),
      makeDeps({ proposeAgentDoc }),
    );
    expect(proposeAgentDoc).toHaveBeenCalledWith(expect.objectContaining({ parentId: null }));
  });

  it("advertises the tree arguments in the schemas a client reads", () => {
    const list = TOOLS.find((t) => t.name === "list_docs");
    const propose = TOOLS.find((t) => t.name === "propose_doc");
    expect(list?.inputSchema.properties).toHaveProperty("parent_id");
    expect(propose?.inputSchema.properties).toHaveProperty("parent_id");
  });
});

describe("what the key's owner can see", () => {
  it("passes the owner to search, so a private space is not in the answer", async () => {
    const queryContext = vi.fn().mockResolvedValue([]);
    await dispatchTool("search_docs", { query: "leave" }, ctx(["read"], "owner-7"), makeDeps({ queryContext }));
    expect(queryContext).toHaveBeenCalledWith(
      "ws1",
      "leave",
      expect.objectContaining({ viewerId: "owner-7" }),
    );
  });

  it("passes the owner to the document list", async () => {
    const listAgentDocs = vi.fn().mockResolvedValue({ docs: [], total: 0 });
    await dispatchTool("list_docs", {}, ctx(["read"], "owner-7"), makeDeps({ listAgentDocs }));
    expect(listAgentDocs).toHaveBeenCalledWith("ws1", expect.objectContaining({ viewerId: "owner-7" }));
  });

  it("passes the owner when reading one document, and when counting its sub-pages", async () => {
    const getAgentDoc = vi.fn().mockResolvedValue({
      id: "d1",
      workspace_id: "ws1",
      title: "Salary bands",
      type: "policy",
      status: "approved",
      body_md: "secret",
      agent_id: null,
      current_revision_id: "r1",
      last_reviewed_at: null,
      updated_at: "2026-08-01",
      frontmatter: { tags: [] },
      space: null,
    });
    const countChildDocs = vi.fn().mockResolvedValue(0);
    await dispatchTool("read_doc", { id: "d1" }, ctx(["read"], "owner-7"), makeDeps({ getAgentDoc, countChildDocs }));
    expect(getAgentDoc).toHaveBeenCalledWith("ws1", "d1", "owner-7");
    expect(countChildDocs).toHaveBeenCalledWith("ws1", "d1", "owner-7");
  });

  it("reports a document it cannot see as absent, not as forbidden", async () => {
    // "You may not see this one" confirms the document exists, which for a
    // private space is the leak itself.
    const getAgentDoc = vi.fn().mockResolvedValue(null);
    const result = await dispatchTool("read_doc", { id: "d1" }, ctx(["read"]), makeDeps({ getAgentDoc }));
    const text = result.content[0].text;
    expect(text).toContain("No document with id");
    expect(text).not.toMatch(/permission|forbidden|private/i);
  });

  it("passes a null owner through rather than falling back to seeing everything", async () => {
    // A key whose owner has left the workspace is a member of nothing, so it
    // reads open spaces only. Silently treating null as "no filter" would give
    // an orphaned key more access than the person it belonged to.
    const listAgentDocs = vi.fn().mockResolvedValue({ docs: [], total: 0 });
    await dispatchTool("list_docs", {}, ctx(["read"], null), makeDeps({ listAgentDocs }));
    expect(listAgentDocs).toHaveBeenCalledWith("ws1", expect.objectContaining({ viewerId: null }));
  });
});

describe("propose_doc", () => {
  const scopes = ctx(["read", "propose"]);

  it("reports a queued proposal as queued, and does not claim a document exists", async () => {
    const deps = makeDeps();
    const result = await dispatchTool(
      "propose_doc",
      { title: "Onboarding", body_md: "welcome" },
      scopes,
      deps,
    );
    expect(payload(result)).toMatchObject({ outcome: "queued_for_review", proposal_id: "p1" });
    // Nothing exists yet, so there is nothing to embed or log against.
    expect(deps.embedDoc).not.toHaveBeenCalled();
    expect(deps.logActivity).not.toHaveBeenCalled();
  });

  it("records who asked in the rationale the reviewer reads", async () => {
    const deps = makeDeps();
    await dispatchTool(
      "propose_doc",
      { title: "T", body_md: "b", note: "Asked for a policy page.", on_behalf_of: "dana@example.com" },
      scopes,
      deps,
    );
    const call = vi.mocked(deps.proposeAgentDoc).mock.calls[0][0];
    expect(call.rationale).toBe("Asked for a policy page.\n\nRequested by dana@example.com.");
    // The key names the integration; the person belongs in the trail, not here.
    expect(call.agentId).toBe("mcp");
    expect(call.agentKeyId).toBe("key1");
  });

  it("embeds and logs once a document actually exists", async () => {
    const doc = {
      id: "d2",
      workspace_id: "ws1",
      status: "approved",
      agent_id: "mcp",
      body_md: "body",
      updated_at: "2026-08-24T00:00:00Z",
      current_revision_id: "rev1",
    };
    const deps = makeDeps({
      getSpaceBySlug: vi.fn().mockResolvedValue({ id: "s1", name: "Marketing", slug: "marketing" }),
      getWorkspaceMeta: vi.fn().mockResolvedValue({
        agentAutoApprove: true,
        docUrl: (id: string) => `https://aqli.test/w/tab/docs/${id}`,
      }),
      proposeAgentDoc: vi.fn().mockResolvedValue({ proposalId: "p2", state: "merged", doc }),
    });

    const result = await dispatchTool(
      "propose_doc",
      { title: "Brief", body_md: "body", space: "marketing", tags: ["q3"] },
      scopes,
      deps,
    );

    expect(payload(result)).toMatchObject({
      outcome: "created",
      id: "d2",
      url: "https://aqli.test/w/tab/docs/d2",
    });
    expect(deps.embedDoc).toHaveBeenCalledWith(doc, "Marketing");
    expect(vi.mocked(deps.logActivity).mock.calls[0][0]).toMatchObject({
      docId: "d2",
      action: "created",
      metadata: expect.objectContaining({ via: "mcp", auto_approved: true }),
    });
  });

  it("does not fail the call when embedding fails — the document already exists", async () => {
    const doc = {
      id: "d3",
      workspace_id: "ws1",
      status: "draft",
      agent_id: "mcp",
      body_md: "body",
      updated_at: "2026-08-24T00:00:00Z",
      current_revision_id: "rev1",
    };
    const deps = makeDeps({
      proposeAgentDoc: vi.fn().mockResolvedValue({ proposalId: "p3", state: "merged", doc }),
      embedDoc: vi.fn().mockRejectedValue(new Error("openai down")),
    });
    const result = await dispatchTool("propose_doc", { title: "T", body_md: "b" }, scopes, deps);
    expect(result.isError).toBeUndefined();
    expect(payload(result).outcome).toBe("created");
  });

  it("refuses an unknown space instead of filing the doc somewhere arbitrary", async () => {
    const deps = makeDeps();
    const result = await dispatchTool(
      "propose_doc",
      { title: "T", body_md: "b", space: "nope" },
      scopes,
      deps,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No space with slug "nope"');
    expect(deps.proposeAgentDoc).not.toHaveBeenCalled();
  });

  it("requires a title and a body", async () => {
    const missingBody = await dispatchTool("propose_doc", { title: "T" }, scopes, makeDeps());
    expect(missingBody.content[0].text).toContain('"body_md" is required');
    const missingTitle = await dispatchTool("propose_doc", { body_md: "b" }, scopes, makeDeps());
    expect(missingTitle.content[0].text).toContain('"title" is required');
  });

  it("rejects tags that are not strings", async () => {
    const result = await dispatchTool(
      "propose_doc",
      { title: "T", body_md: "b", tags: [1, 2] },
      scopes,
      makeDeps(),
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('"tags" must be an array of strings');
  });
});

describe("propose_update", () => {
  const scopes = ctx(["read", "propose"]);
  const existing = {
    id: "d1",
    workspace_id: "ws1",
    title: "Policy",
    type: "policy",
    status: "approved",
    body_md: "old",
    agent_id: null,
    current_revision_id: "rev1",
    last_reviewed_at: null,
    updated_at: "2026-08-01T00:00:00Z",
    frontmatter: { tags: ["hr"] },
    space: { slug: "people", name: "People" },
  };

  it("keeps the existing title and tags when the caller changes only the body", async () => {
    const deps = makeDeps({
      getAgentDoc: vi.fn().mockResolvedValue(existing),
      proposeAgentDoc: vi.fn().mockResolvedValue({
        proposalId: "p4",
        state: "merged",
        doc: { ...existing, body_md: "new", current_revision_id: "rev2" },
      }),
    });
    const result = await dispatchTool(
      "propose_update",
      { id: "d1", body_md: "new", base_revision_id: "rev1" },
      scopes,
      deps,
    );
    const call = vi.mocked(deps.proposeAgentDoc).mock.calls[0][0];
    expect(call).toMatchObject({
      documentId: "d1",
      baseRevisionId: "rev1",
      title: "Policy",
      frontmatter: { tags: ["hr"] },
    });
    expect(payload(result)).toMatchObject({ outcome: "updated", revision_id: "rev2" });
  });

  it("turns a stale base into instructions the agent can follow", async () => {
    const deps = makeDeps({
      getAgentDoc: vi.fn().mockResolvedValue(existing),
      proposeAgentDoc: vi.fn().mockRejectedValue(new FakeMergeError("stale_base")),
    });
    const result = await dispatchTool(
      "propose_update",
      { id: "d1", body_md: "new", base_revision_id: "old" },
      scopes,
      deps,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('read_doc("d1")');
    expect(result.content[0].text).toContain("rev1");
  });

  it("surfaces other merge errors without pretending the edit landed", async () => {
    const deps = makeDeps({
      getAgentDoc: vi.fn().mockResolvedValue(existing),
      proposeAgentDoc: vi.fn().mockRejectedValue(new FakeMergeError("forbidden", 403)),
    });
    const result = await dispatchTool("propose_update", { id: "d1", body_md: "x" }, scopes, deps);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("forbidden");
  });

  it("rethrows anything that is not a merge error", async () => {
    const deps = makeDeps({
      getAgentDoc: vi.fn().mockResolvedValue(existing),
      proposeAgentDoc: vi.fn().mockRejectedValue(new Error("connection reset")),
    });
    await expect(
      dispatchTool("propose_update", { id: "d1", body_md: "x" }, scopes, deps),
    ).rejects.toThrow("connection reset");
  });

  it("reports a queued revision as leaving the document unchanged", async () => {
    const deps = makeDeps({ getAgentDoc: vi.fn().mockResolvedValue(existing) });
    const result = await dispatchTool("propose_update", { id: "d1", body_md: "x" }, scopes, deps);
    expect(payload(result).message).toMatch(/unchanged until a reviewer approves/);
  });

  it("reports a missing document", async () => {
    const result = await dispatchTool(
      "propose_update",
      { id: "gone", body_md: "x" },
      scopes,
      makeDeps(),
    );
    expect(result.isError).toBe(true);
  });
});

describe("request_review", () => {
  const scopes = ctx(["read", "propose"]);

  it("moves the document to review and records why", async () => {
    const deps = makeDeps({
      getAgentDoc: vi.fn().mockResolvedValue({
        id: "d1",
        workspace_id: "ws1",
        title: "Stale doc",
        type: "policy",
        status: "approved",
        body_md: "x",
        agent_id: "mcp",
        current_revision_id: "rev1",
        last_reviewed_at: null,
        updated_at: "2026-08-01T00:00:00Z",
        frontmatter: { tags: [] },
        space: null,
      }),
    });

    const result = await dispatchTool(
      "request_review",
      { id: "d1", note: "Contradicts the new policy." },
      scopes,
      deps,
    );

    expect(deps.setAgentDocStatus).toHaveBeenCalledWith("ws1", "d1", "review");
    expect(vi.mocked(deps.logActivity).mock.calls[0][0]).toMatchObject({
      action: "review_requested",
      metadata: expect.objectContaining({
        via: "mcp",
        note: "Contradicts the new policy.",
        from_status: "approved",
      }),
    });
    expect(payload(result).outcome).toBe("review_requested");
  });

  it("does not flag a document that does not exist", async () => {
    const deps = makeDeps();
    const result = await dispatchTool("request_review", { id: "gone" }, scopes, deps);
    expect(result.isError).toBe(true);
    expect(deps.setAgentDocStatus).not.toHaveBeenCalled();
  });
});
