/**
 * Building a page tree out of a flat list of documents.
 *
 * Kept pure and separate from the data layer because four surfaces need the
 * same shape — the space sidebar, breadcrumbs, search results and the agent
 * tools — and because the interesting cases are the malformed ones, which are
 * far easier to assert on here than through a database.
 *
 * The database already refuses cycles and cross-space parents (20260811000000).
 * This module still defends against both, for one reason: a caller filtering by
 * status or by space hands us a *subset*, in which a perfectly valid parent is
 * simply absent. A subset must not lose documents, so anything whose parent is
 * not in the set is shown at the root rather than dropped.
 */
export type TreeRow = {
  id: string;
  title: string;
  parent_doc_id: string | null;
  position: number;
};

export type TreeNode<T extends TreeRow> = T & {
  children: TreeNode<T>[];
  /** 0 for a root, 1 for its children — what the sidebar indents by. */
  depth: number;
};

/**
 * Siblings sort by position, then title, then id.
 *
 * Position alone is not enough: documents created before this feature all
 * default to 0, so without a tiebreak their order is whatever Postgres
 * returned, and a list that reshuffles between two page loads reads as a bug.
 */
function compare<T extends TreeRow>(a: T, b: T): number {
  if (a.position !== b.position) return a.position - b.position;
  const byTitle = a.title.localeCompare(b.title);
  return byTitle !== 0 ? byTitle : a.id.localeCompare(b.id);
}

export function buildDocTree<T extends TreeRow>(rows: T[]): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const row of rows) byId.set(row.id, { ...row, children: [], depth: 0 });

  const roots: TreeNode<T>[] = [];

  for (const node of byId.values()) {
    const parent = node.parent_doc_id ? byId.get(node.parent_doc_id) : undefined;
    // No parent, a parent outside this set, or a parent that would close a loop
    // (which the database forbids, but a stale client may still describe).
    if (!parent || parent.id === node.id || descends(byId, parent, node.id)) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  const order = (nodes: TreeNode<T>[], depth: number): TreeNode<T>[] => {
    nodes.sort(compare);
    for (const node of nodes) {
      node.depth = depth;
      order(node.children, depth + 1);
    }
    return nodes;
  };

  return order(roots, 0);
}

/** Is `ancestorId` reachable by walking up from `node`? */
function descends<T extends TreeRow>(
  byId: Map<string, TreeNode<T>>,
  node: TreeNode<T>,
  ancestorId: string,
): boolean {
  let current: TreeNode<T> | undefined = node;
  let hops = 0;
  while (current && hops++ < 64) {
    if (current.id === ancestorId) return true;
    current = current.parent_doc_id ? byId.get(current.parent_doc_id) : undefined;
  }
  return false;
}

/**
 * The tree as a render list, skipping anything under a collapsed node.
 *
 * `expanded` holds the ids that are open. A node with no children renders the
 * same either way, so callers do not have to special-case leaves.
 */
export function flattenTree<T extends TreeRow>(
  nodes: TreeNode<T>[],
  expanded: ReadonlySet<string>,
): TreeNode<T>[] {
  const out: TreeNode<T>[] = [];
  const walk = (list: TreeNode<T>[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children.length > 0 && expanded.has(node.id)) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** Every id below a node, not including the node. Used to refuse a drop into a document's own subtree. */
export function descendantIds<T extends TreeRow>(node: TreeNode<T>): string[] {
  const out: string[] = [];
  const walk = (list: TreeNode<T>[]) => {
    for (const child of list) {
      out.push(child.id);
      walk(child.children);
    }
  };
  walk(node.children);
  return out;
}

/**
 * Would moving `docId` under `parentId` be refused?
 *
 * The database is the authority — this is so the UI can decline the drop
 * rather than let go of a page and pop an error.
 */
export function canMoveUnder<T extends TreeRow>(
  rows: T[],
  docId: string,
  parentId: string | null,
): boolean {
  if (parentId === null) return true;
  if (parentId === docId) return false;

  const byId = new Map(rows.map((r) => [r.id, r]));
  if (!byId.has(parentId)) return false;

  let current = byId.get(parentId);
  let hops = 0;
  while (current && hops++ < 64) {
    if (current.id === docId) return false;
    current = current.parent_doc_id ? byId.get(current.parent_doc_id) : undefined;
  }
  return true;
}

/** Ancestors of a document, root first, from a flat list. */
export function pathTo<T extends TreeRow>(rows: T[], docId: string): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const path: T[] = [];
  let current = byId.get(docId);
  let hops = 0;
  while (current?.parent_doc_id && hops++ < 64) {
    const parent = byId.get(current.parent_doc_id);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}
