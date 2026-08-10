import { describe, it, expect } from "vitest";
import {
  formatMention,
  parseMentions,
  extractMentionedMembers,
  toSegments,
  toPlainText,
} from "@/lib/mentions";

const ADA = "0f9c1e8a-1111-4222-8333-444455556666";
const GRACE = "1a2b3c4d-5555-4666-8777-888899990000";
const OUTSIDER = "deadbeef-9999-4888-8777-666655554444";

describe("formatMention", () => {
  it("writes the link-shaped token", () => {
    expect(formatMention(ADA, "Ada Lovelace")).toBe(`@[Ada Lovelace](user:${ADA})`);
  });

  it("strips the characters that would break parsing back out", () => {
    const token = formatMention(ADA, "Ada [the]\nLovelace");
    expect(token).toBe(`@[Ada the Lovelace](user:${ADA})`);
    expect(parseMentions(token)).toEqual([{ userId: ADA, label: "Ada the Lovelace" }]);
  });

  it("keeps the parentheses that disambiguate two people with one name", () => {
    const token = formatMention(ADA, "Ada Lovelace (ada.b)");
    expect(token).toBe(`@[Ada Lovelace (ada.b)](user:${ADA})`);
    expect(parseMentions(token)).toEqual([
      { userId: ADA, label: "Ada Lovelace (ada.b)" },
    ]);
  });

  it("falls back rather than emitting an empty label", () => {
    expect(formatMention(ADA, "   ")).toBe(`@[Member](user:${ADA})`);
  });
});

describe("parseMentions", () => {
  it("finds every mention in order", () => {
    const body = `${formatMention(ADA, "Ada")} and ${formatMention(GRACE, "Grace")} — thoughts?`;
    expect(parseMentions(body).map((m) => m.userId)).toEqual([ADA, GRACE]);
  });

  it("counts a repeated person once", () => {
    const body = `${formatMention(ADA, "Ada")} ${formatMention(ADA, "Ada")}`;
    expect(parseMentions(body)).toHaveLength(1);
  });

  it("does not run past its own closing bracket into the next mention", () => {
    const body = `${formatMention(ADA, "Ada")}${formatMention(GRACE, "Grace")}`;
    expect(parseMentions(body).map((m) => m.label)).toEqual(["Ada", "Grace"]);
  });

  it("ignores things that only look like mentions", () => {
    expect(parseMentions("email me @ada or @[Ada](user:not-a-uuid)")).toEqual([]);
    expect(parseMentions("see [Ada](user:" + ADA + ") — no @")).toEqual([]);
  });

  it("normalises the id's case so two spellings are one person", () => {
    const body = `@[Ada](user:${ADA.toUpperCase()}) @[Ada](user:${ADA})`;
    expect(parseMentions(body)).toEqual([{ userId: ADA, label: "Ada" }]);
  });
});

describe("extractMentionedMembers", () => {
  it("keeps members and drops everyone else", () => {
    const body = [
      formatMention(ADA, "Ada"),
      formatMention(OUTSIDER, "Somebody Else"),
      formatMention(GRACE, "Grace"),
    ].join(" ");
    expect(extractMentionedMembers(body, [ADA, GRACE])).toEqual([ADA, GRACE]);
  });

  it("returns nothing when the workspace has nobody in it", () => {
    expect(extractMentionedMembers(formatMention(ADA, "Ada"), [])).toEqual([]);
  });

  it("is the reason an arbitrary uuid cannot be notified", () => {
    // The attack it exists to stop: naming a uuid that is not a member and
    // having the notification feed deliver to them anyway.
    const body = `Hey ${formatMention(OUTSIDER, "Admin")}, look at this`;
    expect(extractMentionedMembers(body, [ADA, GRACE])).toEqual([]);
  });
});

describe("toSegments", () => {
  it("splits text and mentions", () => {
    const body = `Hi ${formatMention(ADA, "Ada")}, see section 2.`;
    expect(toSegments(body, { [ADA]: "Ada Lovelace" })).toEqual([
      { type: "text", text: "Hi " },
      { type: "mention", userId: ADA, label: "Ada Lovelace" },
      { type: "text", text: ", see section 2." },
    ]);
  });

  it("prefers the current name over the one written at the time", () => {
    const body = formatMention(ADA, "Ada Byron");
    expect(toSegments(body, { [ADA]: "Ada Lovelace" })[0]).toMatchObject({
      label: "Ada Lovelace",
    });
  });

  it("keeps the stored label for someone no longer in the directory", () => {
    const body = formatMention(ADA, "Ada Byron");
    expect(toSegments(body, {})[0]).toMatchObject({ label: "Ada Byron" });
  });

  it("round-trips a body with no mentions unchanged", () => {
    expect(toSegments("just prose")).toEqual([{ type: "text", text: "just prose" }]);
  });

  it("reassembles to the original text", () => {
    const body = `${formatMention(ADA, "Ada")} start, ${formatMention(GRACE, "Grace")} end`;
    const rebuilt = toSegments(body)
      .map((s) => (s.type === "text" ? s.text : formatMention(s.userId, s.label)))
      .join("");
    expect(rebuilt).toBe(body);
  });
});

describe("toPlainText", () => {
  it("reads as a sentence", () => {
    const body = `${formatMention(ADA, "Ada")} can you confirm?`;
    expect(toPlainText(body, { [ADA]: "Ada Lovelace" })).toBe("@Ada Lovelace can you confirm?");
  });
});
