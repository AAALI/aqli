/**
 * Transport-level tests for the MCP endpoint.
 *
 * `lib/mcp/__tests__/tools.test.ts` covers what the tools do; this file covers
 * getting to them: auth, JSON-RPC framing, notifications, and the difference
 * between a tool that reports a problem and a server that failed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authenticateAgent = vi.fn();
const dispatchTool = vi.fn();

vi.mock("../../agent/_auth", () => ({ authenticateAgent }));
vi.mock("../../agent/_workspace", () => ({ getAgentWorkspaceMeta: vi.fn() }));
vi.mock("@/lib/supabase/agent-docs", () => ({
  countChildDocs: vi.fn(),
  getAgentDoc: vi.fn(),
  getServiceSpaceBySlug: vi.fn(),
  listAgentDocs: vi.fn(),
  proposeAgentDoc: vi.fn(),
  setAgentDocStatus: vi.fn(),
}));
vi.mock("@/lib/ai/context", () => ({ queryContext: vi.fn() }));
vi.mock("@/lib/ai/embedder", () => ({ embedDoc: vi.fn() }));
vi.mock("@/lib/supabase/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/db", () => ({ MergeError: class MergeError extends Error {} }));
vi.mock("@/lib/mcp/tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mcp/tools")>();
  return { ...actual, dispatchTool };
});

const { POST, GET } = await import("../route");

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://aqli.test/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const AGENT = { workspaceId: "ws1", keyId: "key1", scopes: ["read", "propose"] };

beforeEach(() => {
  vi.clearAllMocks();
  authenticateAgent.mockResolvedValue(AGENT);
});

describe("auth", () => {
  it("refuses an unauthenticated call with 401 and a WWW-Authenticate header", async () => {
    authenticateAgent.mockResolvedValue(null);
    const res = await POST(post({ jsonrpc: "2.0", id: 1, method: "initialize" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
    // JSON-RPC-shaped body, so a client that only reads the body still learns why.
    expect((await res.json()).error.message).toMatch(/Authorization: Bearer/);
  });

  it("never reaches a tool without a key", async () => {
    authenticateAgent.mockResolvedValue(null);
    await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read_doc" } }));
    expect(dispatchTool).not.toHaveBeenCalled();
  });
});

describe("framing", () => {
  it("answers initialize with a negotiated version and its tool capability", async () => {
    const res = await POST(
      post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } }),
    );
    const body = await res.json();
    expect(body.result.protocolVersion).toBe("2024-11-05");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.id).toBe(1);
  });

  it("acknowledges a notification with no body", async () => {
    const res = await POST(post({ jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("answers ping", async () => {
    const res = await POST(post({ jsonrpc: "2.0", id: "p", method: "ping" }));
    expect((await res.json()).result).toEqual({});
  });

  it("lists the six tools with their schemas, and no internal fields", async () => {
    const res = await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
    const { tools } = (await res.json()).result;
    expect(tools).toHaveLength(6);
    for (const tool of tools) {
      expect(Object.keys(tool).sort()).toEqual(["description", "inputSchema", "name"]);
    }
  });

  it("rejects a malformed body as a parse error", async () => {
    const res = await POST(post("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(-32700);
  });

  it("rejects a message that is not JSON-RPC 2.0", async () => {
    const res = await POST(post({ id: 1, method: "ping" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(-32600);
  });

  it("reports an unknown method rather than failing silently", async () => {
    const res = await POST(post({ jsonrpc: "2.0", id: 1, method: "resources/list" }));
    const body = await res.json();
    expect(body.error.code).toBe(-32601);
    expect(body.error.message).toContain("tools/call");
  });
});

describe("tools/call", () => {
  it("passes the tool name, arguments and the key's context through", async () => {
    dispatchTool.mockResolvedValue({ content: [{ type: "text", text: "{}" }] });
    await POST(
      post({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "read_doc", arguments: { id: "d1" } },
      }),
    );
    expect(dispatchTool).toHaveBeenCalledWith(
      "read_doc",
      { id: "d1" },
      AGENT,
      expect.objectContaining({ queryContext: expect.any(Function) }),
    );
  });

  it("requires a tool name", async () => {
    const res = await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {} }));
    expect((await res.json()).error.code).toBe(-32602);
  });

  it("returns a tool's own error as a result, so the model can react to it", async () => {
    dispatchTool.mockResolvedValue({ content: [{ type: "text", text: "not found" }], isError: true });
    const res = await POST(
      post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read_doc" } }),
    );
    const body = await res.json();
    expect(body.error).toBeUndefined();
    expect(body.result.isError).toBe(true);
  });

  it("turns an unexpected failure into a protocol error, not a tool result", async () => {
    dispatchTool.mockRejectedValue(new Error("db exploded"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read_doc" } }),
    );
    const body = await res.json();
    expect(body.error.code).toBe(-32603);
    // The cause stays in the logs rather than travelling to the client.
    expect(body.error.message).not.toContain("db exploded");
  });
});

describe("GET", () => {
  it("describes the endpoint and says POST, instead of 404-ing a prober", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
    expect((await res.json()).tools).toHaveLength(6);
  });
});
