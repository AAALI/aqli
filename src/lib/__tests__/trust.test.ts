import { describe, expect, it } from "vitest";
import { trustFor, listNames, type TrustInput } from "@/lib/trust";

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

type Over = Omit<Partial<TrustInput>, "doc"> & { doc?: Partial<TrustInput["doc"]> };

function input(over: Over = {}): TrustInput {
  const { doc, ...rest } = over;
  return {
    doc: {
      status: "approved",
      author_type: "human",
      agent_id: null,
      last_reviewed_at: ago(5),
      updated_at: ago(5),
      frontmatter: null as unknown as TrustInput["doc"]["frontmatter"],
      ...doc,
    },
    authorName: "Ali",
    lastCheck: { name: "Sara", at: ago(5) },
    waitingOn: [],
    viewerId: "me",
    canEdit: true,
    relative: () => "5 days ago",
    ...rest,
  };
}

describe("trustFor", () => {
  it("says who checked a Current doc, and when", () => {
    const t = trustFor(input())!;
    expect(t.state).toBe("current");
    expect([t.lead, t.person, t.tail]).toEqual(["checked by", "Sara", ", 5 days ago"]);
    expect(t.action).toBe("reverify");
  });

  it("names who a doc is waiting on, and offers a nudge", () => {
    const t = trustFor(
      input({
        doc: { status: "review", last_reviewed_at: null },
        waitingOn: [
          { id: "s", name: "Sara" },
          { id: "k", name: "Khalid" },
        ],
      }),
    )!;
    expect(t.state).toBe("unverified");
    expect(t.lead).toBe("waiting on Sara and Khalid");
    expect(t.action).toBe("nudge");
  });

  it("asks the viewer to confirm when the doc is waiting on them", () => {
    const t = trustFor(
      input({ doc: { status: "review", last_reviewed_at: null }, waitingOn: [{ id: "me", name: "Ali" }] }),
    )!;
    expect(t.lead).toBe("waiting on you");
    expect(t.action).toBe("confirm");
  });

  it("says a doc was edited since it was checked", () => {
    const t = trustFor(input({ doc: { last_reviewed_at: ago(30), updated_at: ago(1) } }))!;
    expect(t.state).toBe("unverified");
    expect(t.lead).toBe("edited since");
    expect(t.person).toBe("Sara");
  });

  it("attributes an agent-written doc in words, with no special state", () => {
    const t = trustFor(
      input({ doc: { author_type: "agent", agent_id: "Claude Code", last_reviewed_at: null }, lastCheck: null }),
    )!;
    expect(t.state).toBe("unverified");
    expect(t.lead).toBe("written by Claude Code");
    expect(t.tail).toBe(" · nobody has checked it yet");
  });

  it("attributes a PR-written doc to its PR", () => {
    const t = trustFor(
      input({
        doc: {
          last_reviewed_at: null,
          frontmatter: { source_pr_url: "https://github.com/a/b/pull/1247" } as TrustInput["doc"]["frontmatter"],
        },
        lastCheck: null,
      }),
    )!;
    expect(t.lead).toBe("written from PR #1247");
  });

  it("has nothing to say about an unpublished draft", () => {
    expect(trustFor(input({ doc: { status: "draft" } }))).toBeNull();
  });

  it("offers no action to someone who cannot edit", () => {
    expect(trustFor(input({ canEdit: false }))!.action).toBeNull();
  });
});

describe("listNames", () => {
  it("reads like a sentence", () => {
    expect(listNames(["Sara"])).toBe("Sara");
    expect(listNames(["Sara", "Khalid"])).toBe("Sara and Khalid");
    expect(listNames(["Sara", "Khalid", "Yara"])).toBe("Sara, Khalid and Yara");
  });
});
