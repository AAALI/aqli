import { describe, it, expect } from "vitest";
import { resolveMentions, withUniqueLabels } from "../MentionTextarea";
import { parseMentions } from "@/lib/mentions";

const ADA = "0f9c1e8a-1111-4222-8333-444455556666";
const ADA2 = "1a2b3c4d-5555-4666-8777-888899990000";
const GRACE = "2b3c4d5e-6666-4777-8888-999900001111";

describe("withUniqueLabels", () => {
  it("uses the plain name when nobody shares it", () => {
    const labels = withUniqueLabels([
      { user_id: ADA, name: "Ada Lovelace", email: "ada@team.com" },
      { user_id: GRACE, name: "Grace Hopper", email: "grace@team.com" },
    ]);
    expect(labels.map((l) => l.label)).toEqual(["Ada Lovelace", "Grace Hopper"]);
  });

  it("disambiguates two people with the same name", () => {
    const labels = withUniqueLabels([
      { user_id: ADA, name: "Ada Lovelace", email: "ada@team.com" },
      { user_id: ADA2, name: "Ada Lovelace", email: "ada.b@team.com" },
      { user_id: GRACE, name: "Grace Hopper", email: "grace@team.com" },
    ]);
    expect(labels.map((l) => l.label)).toEqual([
      "Ada Lovelace (ada)",
      "Ada Lovelace (ada.b)",
      "Grace Hopper",
    ]);
    // The point of the exercise: no label addresses two people.
    expect(new Set(labels.map((l) => l.label)).size).toBe(3);
  });
});

describe("resolveMentions", () => {
  it("turns a chosen name into a token", () => {
    const chosen = new Map([["Ada Lovelace", ADA]]);
    const out = resolveMentions("@Ada Lovelace can you check this?", chosen);
    expect(out).toBe(`@[Ada Lovelace](user:${ADA}) can you check this?`);
    expect(parseMentions(out).map((m) => m.userId)).toEqual([ADA]);
  });

  it("leaves a name the author typed by hand as plain text", () => {
    // No guessing: only what was picked from the menu becomes a mention.
    expect(resolveMentions("@ada please look", new Map())).toBe("@ada please look");
  });

  it("links every occurrence of a chosen name", () => {
    const chosen = new Map([["Ada Lovelace", ADA]]);
    const out = resolveMentions("@Ada Lovelace and again @Ada Lovelace", chosen);
    expect(out.match(/user:/g)).toHaveLength(2);
    // One person, mentioned twice.
    expect(parseMentions(out)).toHaveLength(1);
  });

  it("does not let a shorter label eat a longer one that contains it", () => {
    const chosen = new Map([
      ["Ada Lovelace", ADA],
      ["Ada Lovelace (ada.b)", ADA2],
    ]);
    const out = resolveMentions("@Ada Lovelace (ada.b) and @Ada Lovelace", chosen);
    expect(parseMentions(out).map((m) => m.userId)).toEqual([ADA2, ADA]);
  });

  it("handles names containing regex metacharacters", () => {
    const chosen = new Map([["A. (Sam) O'Neil +1", ADA]]);
    const out = resolveMentions("hi @A. (Sam) O'Neil +1 there", chosen);
    expect(parseMentions(out).map((m) => m.userId)).toEqual([ADA]);
  });

  it("passes a body with no mentions through untouched", () => {
    expect(resolveMentions("no mentions here", new Map([["Ada", ADA]]))).toBe(
      "no mentions here",
    );
  });
});
