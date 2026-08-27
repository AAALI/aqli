import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  RPC_ERRORS,
  initializeResult,
  negotiateProtocolVersion,
  parseMessage,
  rpcError,
  rpcResult,
} from "../protocol";

describe("parseMessage", () => {
  it("reads a well-formed request", () => {
    const parsed = parseMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(parsed).toEqual({
      kind: "request",
      request: { jsonrpc: "2.0", id: 1, method: "tools/list", params: undefined },
    });
  });

  it("keeps string ids as strings", () => {
    const parsed = parseMessage({ jsonrpc: "2.0", id: "abc", method: "ping" });
    expect(parsed.kind === "request" && parsed.request.id).toBe("abc");
  });

  it("treats a message with no id as a notification", () => {
    expect(parseMessage({ jsonrpc: "2.0", method: "notifications/initialized" })).toEqual({
      kind: "notification",
      method: "notifications/initialized",
    });
  });

  it("rejects a batch, because this server does not implement one", () => {
    const parsed = parseMessage([{ jsonrpc: "2.0", id: 1, method: "ping" }]);
    expect(parsed.kind).toBe("invalid");
    expect(parsed.kind === "invalid" && parsed.code).toBe(RPC_ERRORS.INVALID_REQUEST);
  });

  it.each([
    ["a missing jsonrpc version", { id: 1, method: "ping" }],
    ["a wrong jsonrpc version", { jsonrpc: "1.0", id: 1, method: "ping" }],
    ["a missing method", { jsonrpc: "2.0", id: 1 }],
    ["an empty method", { jsonrpc: "2.0", id: 1, method: "" }],
    ["a non-object body", "ping"],
  ])("rejects %s", (_label, body) => {
    expect(parseMessage(body).kind).toBe("invalid");
  });

  it("reports the id it was given so the client can match the error up", () => {
    const parsed = parseMessage({ jsonrpc: "1.0", id: 7, method: "ping" });
    expect(parsed.kind === "invalid" && parsed.id).toBe(7);
  });

  it("drops params that are not an object", () => {
    const parsed = parseMessage({ jsonrpc: "2.0", id: 1, method: "ping", params: "no" });
    expect(parsed.kind === "request" && parsed.request.params).toBeUndefined();
  });
});

describe("negotiateProtocolVersion", () => {
  it("echoes a version we support", () => {
    expect(negotiateProtocolVersion("2024-11-05")).toBe("2024-11-05");
  });

  it("answers with our own version when the client asks for one we do not know", () => {
    expect(negotiateProtocolVersion("1999-01-01")).toBe(PROTOCOL_VERSION);
    expect(negotiateProtocolVersion(undefined)).toBe(PROTOCOL_VERSION);
    expect(negotiateProtocolVersion(42)).toBe(PROTOCOL_VERSION);
  });
});

describe("response builders", () => {
  it("shapes a result", () => {
    expect(rpcResult(1, { ok: true })).toEqual({ jsonrpc: "2.0", id: 1, result: { ok: true } });
  });

  it("shapes an error, omitting absent data", () => {
    expect(rpcError(1, -32601, "nope")).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "nope" },
    });
  });

  it("declares tools and names itself on initialize", () => {
    const result = initializeResult("2025-06-18");
    expect(result.protocolVersion).toBe("2025-06-18");
    expect(result.capabilities.tools).toBeDefined();
    expect(result.serverInfo.name).toBe("aqli");
    // The proposal contract has to reach the model, or it will report queued
    // drafts as published.
    expect(result.instructions).toMatch(/approve/i);
  });
});
