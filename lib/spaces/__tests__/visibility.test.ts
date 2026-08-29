import { describe, it, expect } from "vitest";
import { excludeBlockedSpaces, isSpaceVisible } from "../visibility";

function fakeQuery() {
  const filters: string[] = [];
  const query = {
    filters,
    or(filter: string) {
      filters.push(filter);
      return query;
    },
  };
  return query;
}

describe("excludeBlockedSpaces", () => {
  it("adds no filter when nothing is blocked", () => {
    const query = fakeQuery();
    excludeBlockedSpaces(query, []);
    expect(query.filters).toEqual([]);
  });

  it("keeps documents that have no space at all", () => {
    // `space_id not in (…)` is null for a null space_id, so a plain `not in`
    // would hide every workspace-wide document. That is the bug this arm exists
    // to prevent, and it would have looked like data loss rather than a leak.
    const query = fakeQuery();
    excludeBlockedSpaces(query, ["s1", "s2"]);
    expect(query.filters).toEqual(["space_id.is.null,space_id.not.in.(s1,s2)"]);
  });

  it("can filter a differently named column", () => {
    const query = fakeQuery();
    excludeBlockedSpaces(query, ["s1"], "doc_space_id");
    expect(query.filters).toEqual(["doc_space_id.is.null,doc_space_id.not.in.(s1)"]);
  });
});

describe("isSpaceVisible", () => {
  it("hides a blocked space", () => {
    expect(isSpaceVisible("s1", ["s1"])).toBe(false);
  });

  it("shows anything else", () => {
    expect(isSpaceVisible("s2", ["s1"])).toBe(true);
  });

  it("treats a document with no space as workspace-wide", () => {
    expect(isSpaceVisible(null, ["s1"])).toBe(true);
    expect(isSpaceVisible(undefined, ["s1"])).toBe(true);
  });
});
