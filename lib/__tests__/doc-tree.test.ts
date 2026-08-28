import { describe, it, expect } from "vitest";
import {
  buildDocTree,
  flattenTree,
  descendantIds,
  canMoveUnder,
  pathTo,
  type TreeRow,
} from "../doc-tree";

const row = (id: string, parent: string | null, position = 0, title = id): TreeRow => ({
  id,
  title,
  parent_doc_id: parent,
  position,
});

const titles = (nodes: { title: string }[]) => nodes.map((n) => n.title);

describe("buildDocTree", () => {
  it("nests children under their parent", () => {
    const tree = buildDocTree([
      row("benefits", null),
      row("leave", "benefits"),
      row("parental", "leave"),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("benefits");
    expect(tree[0].children[0].id).toBe("leave");
    expect(tree[0].children[0].children[0].id).toBe("parental");
  });

  it("records depth, which is what the sidebar indents by", () => {
    const tree = buildDocTree([row("a", null), row("b", "a"), row("c", "b")]);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[0].children[0].depth).toBe(2);
  });

  it("orders siblings by position", () => {
    const tree = buildDocTree([
      row("home", null),
      row("third", "home", 2),
      row("first", "home", 0),
      row("second", "home", 1),
    ]);
    expect(titles(tree[0].children)).toEqual(["first", "second", "third"]);
  });

  it("falls back to title when positions tie, so the order does not shuffle between loads", () => {
    // Every document created before sub-pages existed has position 0.
    const tree = buildDocTree([
      row("home", null),
      row("c", "home", 0, "Onboarding"),
      row("a", "home", 0, "Benefits"),
      row("b", "home", 0, "Expenses"),
    ]);
    expect(titles(tree[0].children)).toEqual(["Benefits", "Expenses", "Onboarding"]);
  });

  it("shows a document whose parent is not in the set, rather than losing it", () => {
    // The real case: a caller filtered by status, and the parent is a draft.
    const tree = buildDocTree([row("orphan", "a-draft-not-in-this-list")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("does not hang or drop documents if a cycle ever reaches it", () => {
    // The database refuses these; this is about a stale client's payload.
    const tree = buildDocTree([row("a", "b"), row("b", "a")]);
    const seen = new Set<string>();
    const walk = (nodes: ReturnType<typeof buildDocTree>) => {
      for (const n of nodes) {
        seen.add(n.id);
        walk(n.children);
      }
    };
    walk(tree);
    expect(seen).toEqual(new Set(["a", "b"]));
  });

  it("leaves the input alone", () => {
    const rows = [row("a", null), row("b", "a")];
    buildDocTree(rows);
    expect(rows[0]).not.toHaveProperty("children");
  });
});

describe("flattenTree", () => {
  const tree = buildDocTree([
    row("benefits", null, 0),
    row("leave", "benefits", 0),
    row("parental", "leave", 0),
    row("expenses", null, 1),
  ]);

  it("hides what is under a collapsed node", () => {
    expect(titles(flattenTree(tree, new Set()))).toEqual(["benefits", "expenses"]);
  });

  it("reveals one level per expanded node", () => {
    expect(titles(flattenTree(tree, new Set(["benefits"])))).toEqual([
      "benefits",
      "leave",
      "expenses",
    ]);
    expect(titles(flattenTree(tree, new Set(["benefits", "leave"])))).toEqual([
      "benefits",
      "leave",
      "parental",
      "expenses",
    ]);
  });
});

describe("canMoveUnder", () => {
  const rows = [row("a", null), row("b", "a"), row("c", "b"), row("other", null)];

  it("allows a move to the root", () => {
    expect(canMoveUnder(rows, "c", null)).toBe(true);
  });

  it("allows a move to an unrelated document", () => {
    expect(canMoveUnder(rows, "c", "other")).toBe(true);
  });

  it("refuses a document as its own parent", () => {
    expect(canMoveUnder(rows, "a", "a")).toBe(false);
  });

  it("refuses a drop into the document's own subtree", () => {
    // Dragging the top of a section into something below it would take the
    // whole section out of the tree.
    expect(canMoveUnder(rows, "a", "c")).toBe(false);
    expect(canMoveUnder(rows, "a", "b")).toBe(false);
  });

  it("refuses a parent it cannot see", () => {
    expect(canMoveUnder(rows, "a", "somewhere-else")).toBe(false);
  });
});

describe("descendantIds", () => {
  it("lists the whole subtree, excluding the node", () => {
    const tree = buildDocTree([row("a", null), row("b", "a"), row("c", "b"), row("d", "a")]);
    expect(descendantIds(tree[0]).sort()).toEqual(["b", "c", "d"]);
  });
});

describe("pathTo", () => {
  const rows = [row("benefits", null), row("leave", "benefits"), row("parental", "leave")];

  it("returns ancestors root first, excluding the document", () => {
    expect(titles(pathTo(rows, "parental"))).toEqual(["benefits", "leave"]);
  });

  it("is empty for a root", () => {
    expect(pathTo(rows, "benefits")).toEqual([]);
  });

  it("stops at the edge of what it was given", () => {
    expect(pathTo([row("leave", "benefits")], "leave")).toEqual([]);
  });
});
