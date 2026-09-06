/**
 * JSON-RPC 2.0 for MCP — hand-rolled on purpose.
 *
 * The worker has ~900 KiB of headroom under Cloudflare's 3,072 KiB free-plan
 * limit (`reports/HANDOVER.md` §3), and `@modelcontextprotocol/sdk` pulls in a
 * transport stack this endpoint does not use. The surface a stateless HTTP
 * server actually needs is four methods and two response shapes, so it lives
 * here instead — in a module with no dependencies, which is also what makes it
 * testable without a database.
 *
 * Stateless by design: no SSE, no session ids. Every request carries its
 * bearer key and is answered on the spot, because a Worker gives no guarantee
 * that two requests reach the same isolate.
 */

/** Versions this server can speak, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

export const PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** Standard JSON-RPC error codes. */
export const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type RpcId = string | number | null;

export type RpcRequest = {
  jsonrpc: "2.0";
  id: RpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type RpcResponse =
  | { jsonrpc: "2.0"; id: RpcId; result: unknown }
  | { jsonrpc: "2.0"; id: RpcId; error: { code: number; message: string; data?: unknown } };

/**
 * What a parsed message turned out to be.
 *
 * A notification (no `id`) gets no response body at all — returning one for
 * `notifications/initialized` makes strict clients complain, so the caller
 * needs to tell the two apart before answering.
 */
export type ParsedMessage =
  | { kind: "request"; request: RpcRequest }
  | { kind: "notification"; method: string }
  | { kind: "invalid"; id: RpcId; code: number; message: string };

export function parseMessage(raw: unknown): ParsedMessage {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      kind: "invalid",
      id: null,
      code: RPC_ERRORS.INVALID_REQUEST,
      message: "Request must be a JSON-RPC object. Batching is not supported.",
    };
  }

  const msg = raw as Record<string, unknown>;
  const id = (typeof msg.id === "string" || typeof msg.id === "number" ? msg.id : null) as RpcId;

  if (msg.jsonrpc !== "2.0") {
    return {
      kind: "invalid",
      id,
      code: RPC_ERRORS.INVALID_REQUEST,
      message: 'Missing or invalid "jsonrpc": expected "2.0".',
    };
  }
  if (typeof msg.method !== "string" || msg.method.length === 0) {
    return {
      kind: "invalid",
      id,
      code: RPC_ERRORS.INVALID_REQUEST,
      message: 'Missing or invalid "method".',
    };
  }

  // No id (and not an explicit null id) means notification: acknowledge, say
  // nothing back.
  if (!("id" in msg) || msg.id === undefined) {
    return { kind: "notification", method: msg.method };
  }

  const params =
    typeof msg.params === "object" && msg.params !== null && !Array.isArray(msg.params)
      ? (msg.params as Record<string, unknown>)
      : undefined;

  return { kind: "request", request: { jsonrpc: "2.0", id, method: msg.method, params } };
}

export function rpcResult(id: RpcId, result: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(
  id: RpcId,
  code: number,
  message: string,
  data?: unknown,
): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } };
}

/**
 * Echo back a protocol version both sides know.
 *
 * The spec says to answer with a version the client asked for when we support
 * it, and with our own when we do not — the client then decides whether it can
 * live with that, rather than the connection failing here.
 */
export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : PROTOCOL_VERSION;
}

export const SERVER_INFO = { name: "aqli", version: "1.0.0" } as const;

export function initializeResult(requestedVersion: unknown) {
  return {
    protocolVersion: negotiateProtocolVersion(requestedVersion),
    capabilities: { tools: { listChanged: false } },
    serverInfo: SERVER_INFO,
    instructions:
      "Aqli is this workspace's knowledge base. Search it before answering questions " +
      "about company policy, process, or decisions — approved docs are the reviewed " +
      "source of truth. Writes are proposals: a person reviews and approves them " +
      "before they become trusted context, so say so rather than reporting a doc as published.",
  };
}
