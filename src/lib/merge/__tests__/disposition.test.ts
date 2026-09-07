import { describe, it, expect } from "vitest";
import {
  decideDisposition,
  type ActorType,
  type AgentScope,
  type DocClass,
  type Disposition,
  type ReviewPolicy,
} from "../disposition";

const POLICIES: ReviewPolicy[] = ["open", "review_agents", "review_all"];
const ACTORS: ActorType[] = ["human", "agent", "system"];
const CLASSES: DocClass[] = ["canon", "record"];

const READ: AgentScope[] = ["read"];
const PROPOSE: AgentScope[] = ["read", "propose"];
const WRITE: AgentScope[] = ["read", "propose", "write"];

describe("decideDisposition", () => {
  describe("records", () => {
    // A record is an immutable statement that something happened. Queueing one
    // would be asking a human to approve history.
    it("always merges, whatever the policy, actor or scopes", () => {
      for (const spacePolicy of POLICIES) {
        for (const actorType of ACTORS) {
          for (const scopes of [[], READ, PROPOSE, WRITE]) {
            expect(
              decideDisposition({ spacePolicy, actorType, scopes, docClass: "record" }),
            ).toBe("merge");
          }
        }
      }
    });
  });

  describe("open spaces", () => {
    it("merges every canon write", () => {
      for (const actorType of ACTORS) {
        expect(
          decideDisposition({
            spacePolicy: "open",
            actorType,
            scopes: [],
            docClass: "canon",
          }),
        ).toBe("merge");
      }
    });
  });

  describe("review_all spaces", () => {
    // The deliberate one: humans queue too. A compliance space where the
    // people who own it can bypass the queue is not a compliance space.
    it("queues every canon write, humans included", () => {
      for (const actorType of ACTORS) {
        expect(
          decideDisposition({
            spacePolicy: "review_all",
            actorType,
            scopes: WRITE,
            docClass: "canon",
          }),
        ).toBe("queue");
      }
    });
  });

  describe("review_agents spaces", () => {
    it("merges human writes", () => {
      expect(
        decideDisposition({
          spacePolicy: "review_agents",
          actorType: "human",
          scopes: [],
          docClass: "canon",
        }),
      ).toBe("merge");
    });

    it("merges an agent write only when the key carries the write scope", () => {
      expect(
        decideDisposition({
          spacePolicy: "review_agents",
          actorType: "agent",
          scopes: WRITE,
          docClass: "canon",
        }),
      ).toBe("merge");

      for (const scopes of [[], READ, PROPOSE]) {
        expect(
          decideDisposition({
            spacePolicy: "review_agents",
            actorType: "agent",
            scopes,
            docClass: "canon",
          }),
        ).toBe("queue");
      }
    });

    // `system` is the PR ingester and the importer. They are not people, so
    // they do not get the human bypass, and they hold no key, so they have no
    // scopes — which lands them in the queue for canon. Records (what the
    // ingester actually writes) bypass review on the rule above.
    it("queues system writes to canon", () => {
      expect(
        decideDisposition({
          spacePolicy: "review_agents",
          actorType: "system",
          scopes: [],
          docClass: "canon",
        }),
      ).toBe("queue");
    });
  });

  // The full table, written out. This is the artefact to diff against
  // `app.decide_disposition` when either side changes.
  describe("truth table", () => {
    const cases: [ReviewPolicy, ActorType, AgentScope[], DocClass, Disposition][] = [
      ["open", "human", [], "canon", "merge"],
      ["open", "agent", PROPOSE, "canon", "merge"],
      ["open", "agent", READ, "canon", "merge"],
      ["open", "system", [], "canon", "merge"],
      ["open", "human", [], "record", "merge"],

      ["review_agents", "human", [], "canon", "merge"],
      ["review_agents", "agent", WRITE, "canon", "merge"],
      ["review_agents", "agent", PROPOSE, "canon", "queue"],
      ["review_agents", "agent", READ, "canon", "queue"],
      ["review_agents", "agent", [], "canon", "queue"],
      ["review_agents", "system", [], "canon", "queue"],
      ["review_agents", "agent", PROPOSE, "record", "merge"],

      ["review_all", "human", [], "canon", "queue"],
      ["review_all", "agent", WRITE, "canon", "queue"],
      ["review_all", "agent", PROPOSE, "canon", "queue"],
      ["review_all", "system", [], "canon", "queue"],
      ["review_all", "human", [], "record", "merge"],
      ["review_all", "agent", WRITE, "record", "merge"],
    ];

    it.each(cases)(
      "%s / %s / %j / %s -> %s",
      (spacePolicy, actorType, scopes, docClass, expected) => {
        expect(decideDisposition({ spacePolicy, actorType, scopes, docClass })).toBe(
          expected,
        );
      },
    );
  });

  it("is total — every combination returns a disposition", () => {
    for (const spacePolicy of POLICIES) {
      for (const actorType of ACTORS) {
        for (const docClass of CLASSES) {
          for (const scopes of [[], READ, PROPOSE, WRITE]) {
            const d = decideDisposition({ spacePolicy, actorType, scopes, docClass });
            expect(["merge", "queue"]).toContain(d);
          }
        }
      }
    }
  });
});
