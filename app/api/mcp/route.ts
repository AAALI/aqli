/**
 * MCP server.
 *
 * One endpoint, stateless: `POST /api/mcp` speaks JSON-RPC over plain HTTP,
 * with no SSE stream and no session id. A Worker cannot promise that two
 * requests land in the same isolate, so anything that needed session affinity
 * would be broken by the platform rather than by the client.
 *
 * Auth is the same bearer key the REST agent API takes (`Authorization: Bearer
 * aqli_…`), which is what makes attribution work: the key belongs to a member,
 * every write it makes is a proposal recorded against it, and `on_behalf_of`
 * names the person who asked. There is no OAuth flow in v1 — the client stores
 * the key.
 *
 * The protocol and the tool logic live in `lib/mcp/*`; this file is transport
 * and dependency wiring only.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../agent/_auth";
import { getAgentWorkspaceMeta } from "../agent/_workspace";
import {
  PROTOCOL_VERSION,
  RPC_ERRORS,
  initializeResult,
  parseMessage,
  rpcError,
  rpcResult,
} from "@/lib/mcp/protocol";
import { TOOLS, dispatchTool, type ToolDeps } from "@/lib/mcp/tools";
import {
  countChildDocs,
  getAgentDoc,
  getServiceSpaceBySlug,
  listAgentDocs,
  proposeAgentDoc,
  setAgentDocStatus,
} from "@/lib/supabase/agent-docs";
import { queryContext } from "@/lib/ai/context";
import { embedDoc } from "@/lib/ai/embedder";
import { logActivity } from "@/lib/supabase/activity";
import { notifyWebhooks } from "@/lib/notifications/dispatch";
import { MergeError } from "@/lib/db";
import type { ActivityAction } from "@/types/activity";
import type { Doc } from "@/types/doc";

/** Bearer-keyed and per-request; nothing here is cacheable. */
export const dynamic = "force-dynamic";

const deps: ToolDeps = {
  queryContext,
  listAgentDocs,
  getAgentDoc,
  countChildDocs,
  proposeAgentDoc,
  setAgentDocStatus,
  getSpaceBySlug: getServiceSpaceBySlug,
  notifyWebhooks,
  getWorkspaceMeta: getAgentWorkspaceMeta,
  // The tool layer is typed structurally so it can be tested with fakes; these
  // two casts are where the real, wider types meet those narrow shapes.
  logActivity: (input) =>
    logActivity({ ...input, action: input.action as ActivityAction }),
  embedDoc: (doc, spaceName) => embedDoc(doc as Doc, spaceName),
  MergeError: MergeError as unknown as ToolDeps["MergeError"],
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, status === 200 ? undefined : { status });
}

function unauthorized() {
  // A 401 tells an MCP client its key is the problem. The body is JSON-RPC
  // shaped so a client that only reads the body still gets a usable message.
  return NextResponse.json(
    rpcError(
      null,
      RPC_ERRORS.INVALID_REQUEST,
      "Unauthorized. Send an Aqli API key as `Authorization: Bearer aqli_…`; " +
        "a workspace admin creates one in Settings → API keys.",
    ),
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="aqli"' } },
  );
}

export async function POST(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) return unauthorized();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(rpcError(null, RPC_ERRORS.PARSE_ERROR, "Request body is not valid JSON."), 400);
  }

  const parsed = parseMessage(raw);
  if (parsed.kind === "invalid") {
    return json(rpcError(parsed.id, parsed.code, parsed.message), 400);
  }
  // A notification expects no response body — `notifications/initialized`
  // being the one every client sends.
  if (parsed.kind === "notification") {
    return new NextResponse(null, { status: 202 });
  }

  const { id, method, params } = parsed.request;

  switch (method) {
    case "initialize":
      return json(rpcResult(id, initializeResult(params?.protocolVersion)));

    case "ping":
      return json(rpcResult(id, {}));

    case "tools/list":
      return json(
        rpcResult(id, {
          tools: TOOLS.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        }),
      );

    case "tools/call": {
      const name = typeof params?.name === "string" ? params.name : null;
      if (!name) {
        return json(rpcError(id, RPC_ERRORS.INVALID_PARAMS, 'tools/call requires "name".'));
      }
      try {
        const result = await dispatchTool(name, params?.arguments, agent, deps);
        return json(rpcResult(id, result));
      } catch (err) {
        // An unexpected failure is the server's fault, so it goes back as a
        // protocol error rather than as a tool result the model would try to
        // reason about.
        console.error("MCP tool failed", { tool: name, workspace: agent.workspaceId }, err);
        return json(
          rpcError(id, RPC_ERRORS.INTERNAL_ERROR, `Tool "${name}" failed. The error is logged.`),
        );
      }
    }

    default:
      return json(
        rpcError(
          id,
          RPC_ERRORS.METHOD_NOT_FOUND,
          `Unsupported method "${method}". This server implements initialize, ping, ` +
            "tools/list and tools/call.",
        ),
      );
  }
}

/**
 * Some clients probe with GET before posting. Answer plainly — a 405 with a
 * hint beats a framework 404 that looks like the endpoint does not exist.
 */
export async function GET() {
  return NextResponse.json(
    {
      name: "aqli",
      protocolVersion: PROTOCOL_VERSION,
      transport: "streamable-http (stateless, POST only)",
      tools: TOOLS.map((t) => t.name),
      hint: "POST JSON-RPC 2.0 here with an `Authorization: Bearer aqli_…` header.",
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}
