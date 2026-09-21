import { docState, editedSinceConfirmed, isPublished, type DocState, type Stateful } from "@/lib/doc-status";
import type { DocStatus } from "@/types/doc";

/**
 * What the trust line says (v3 §2, §3).
 *
 * One line under the title: the state, then *why* — who checked it and when,
 * who it is waiting on, or that nobody has. Kept as a pure function of the doc
 * and its trail so every case is testable and the page only renders it.
 *
 * Agent- and PR-authored docs are attributed here, in words, and nowhere else
 * on the surface — no chip, no special state (§3.6).
 */
export type TrustAction = "confirm" | "reverify" | "nudge" | null;

export type Trust = {
  state: DocState;
  /** Text before the person, e.g. "checked by". */
  lead: string;
  /** The person named, rendered with an avatar. */
  person: string | null;
  /** Text after the person, e.g. ", 5 days ago". */
  tail: string;
  action: TrustAction;
};

export type TrustInput = {
  doc: Stateful & {
    status: DocStatus;
    author_type: "human" | "agent";
    agent_id: string | null;
    frontmatter: Stateful["frontmatter"] & { source_pr_url?: string };
  };
  authorName: string | null;
  /** The most recent confirmation: who, and when. */
  lastCheck: { name: string | null; at: string } | null;
  /** People asked to check it and not yet answered. */
  waitingOn: { id: string; name: string }[];
  viewerId: string | null;
  canEdit: boolean;
  /** "3 days ago" — injected so this stays deterministic under test. */
  relative: (iso: string) => string;
};

export function trustFor(input: TrustInput): Trust | null {
  const { doc, authorName, lastCheck, waitingOn, viewerId, canEdit, relative } = input;
  if (!isPublished(doc.status)) return null;

  const state = docState(doc);
  const pr = prNumber(doc.frontmatter?.source_pr_url);

  // Somebody was asked and has not answered.
  if (doc.status === "review") {
    const askedMe = viewerId !== null && waitingOn.some((w) => w.id === viewerId);
    const names = waitingOn.map((w) => (w.id === viewerId ? "you" : w.name));
    return {
      state: "unverified",
      lead: names.length ? `waiting on ${listNames(names)}` : "waiting on a check",
      person: null,
      tail: "",
      action: askedMe ? "confirm" : canEdit ? "nudge" : null,
    };
  }

  // Confirmed, then changed.
  if (lastCheck && editedSinceConfirmed(doc)) {
    return {
      state,
      lead: "edited since",
      person: lastCheck.name,
      tail: ` checked it, ${relative(lastCheck.at)}`,
      action: canEdit ? "reverify" : null,
    };
  }

  // Never confirmed by anyone.
  if (state === "unverified") {
    return {
      state,
      lead: origin(doc, pr, authorName),
      person: null,
      tail: " · nobody has checked it yet",
      action: canEdit ? "confirm" : null,
    };
  }

  // Current or Ageing: say who last stood behind it.
  if (pr && lastCheck && !lastCheck.name) {
    return {
      state,
      lead: `written from PR #${pr} · merged ${relative(lastCheck.at)}`,
      person: null,
      tail: "",
      action: canEdit ? "reverify" : null,
    };
  }
  return {
    state,
    lead: "checked by",
    person: lastCheck?.name ?? authorName,
    tail: `, ${relative(lastCheck?.at ?? doc.last_reviewed_at ?? doc.updated_at)}`,
    action: canEdit ? "reverify" : null,
  };
}

function origin(
  doc: TrustInput["doc"],
  pr: string | null,
  authorName: string | null,
): string {
  if (pr) return `written from PR #${pr}`;
  if (doc.author_type === "agent") return `written by ${doc.agent_id ?? "an agent"}`;
  return `published by ${authorName ?? "a teammate"}`;
}

function prNumber(url: string | undefined): string | null {
  return url?.match(/\/pull\/(\d+)/)?.[1] ?? null;
}

/** "Sara", "Sara and Khalid", "Sara, Khalid and Yara". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
