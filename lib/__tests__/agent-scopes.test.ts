/**
 * Scope normalization is the only thing standing between a request body and
 * what a key is allowed to do, so it is worth pinning: `write` is the
 * difference between an agent's change queueing for review and landing in the
 * document (see `decideDisposition`).
 */
import { describe, expect, it } from "vitest";
import {
  AGENT_SCOPES,
  DEFAULT_AGENT_SCOPES,
  normalizeScopes,
} from "@/lib/agent-scopes";
import { decideDisposition } from "@/lib/merge/disposition";

describe("normalizeScopes", () => {
  it("keeps a valid set", () => {
    expect(normalizeScopes(["read", "propose"])).toEqual(["read", "propose"]);
    expect(normalizeScopes(["read", "propose", "write"])).toEqual([
      "read",
      "propose",
      "write",
    ]);
  });

  it("always includes read, which every agent endpoint needs", () => {
    expect(normalizeScopes(["propose"])).toEqual(["read", "propose"]);
    expect(normalizeScopes([])).toEqual(["read"]);
  });

  it("returns scopes in a stable order regardless of input order", () => {
    expect(normalizeScopes(["write", "propose", "read"])).toEqual([
      "read",
      "propose",
      "write",
    ]);
  });

  it("drops anything not in the enum rather than passing it to Postgres", () => {
    expect(normalizeScopes(["read", "admin", "delete", "write"])).toEqual([
      "read",
      "write",
    ]);
  });

  it("does not invent scopes from junk input", () => {
    for (const junk of [null, undefined, "write", 7, {}, [["write"]]]) {
      expect(normalizeScopes(junk)).toEqual(["read"]);
    }
  });

  it("never grants write unless write was asked for", () => {
    for (const input of [[], ["read"], ["propose"], ["read", "propose"], null]) {
      expect(normalizeScopes(input)).not.toContain("write");
    }
  });

  it("the default set matches the database column default", () => {
    expect(DEFAULT_AGENT_SCOPES).toEqual(["read", "propose"]);
    expect(normalizeScopes(DEFAULT_AGENT_SCOPES)).toEqual(DEFAULT_AGENT_SCOPES);
  });

  it("covers the whole enum", () => {
    expect(AGENT_SCOPES).toEqual(["read", "propose", "write"]);
  });
});

describe("scopes as the UI describes them", () => {
  // The keys screen tells an admin that "write directly" means changes merge
  // "unless the space reviews everything". That claim is the disposition rule.
  const agent = (scopes: Parameters<typeof decideDisposition>[0]["scopes"]) =>
    ({ actorType: "agent", scopes, docClass: "canon" }) as const;

  it("write merges in a review_agents space", () => {
    expect(
      decideDisposition({ spacePolicy: "review_agents", ...agent(["read", "write"]) }),
    ).toBe("merge");
  });

  it("without write it queues in a review_agents space", () => {
    expect(
      decideDisposition({ spacePolicy: "review_agents", ...agent(["read", "propose"]) }),
    ).toBe("queue");
  });

  it("review_all queues even a write-scoped key", () => {
    expect(
      decideDisposition({ spacePolicy: "review_all", ...agent(["read", "write"]) }),
    ).toBe("queue");
  });
});
