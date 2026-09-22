import { isDocOverdue, type VerifyCadence } from "@/lib/verify-cadence";
import type { DocStatus } from "@/types/doc";

/**
 * The one status system (v3 §3): Current · Ageing · Unverified.
 *
 * One question — *is this still true?* — with three answers. The lifecycle
 * column (`docs.status`) still exists in the database and still drives the
 * merge engine, but it never reaches a screen: Draft, Review, Approved and
 * Stale are gone from the display layer entirely. "Draft" is a *place*
 * (`/drafts`), not a state.
 *
 * Verification here is opt-in, and only bites on shared work. Publishing
 * something nobody asked anyone to check *is* the confirmation — your own docs
 * do not need a second signature and never nag you. A doc only starts ageing
 * once a human has actually confirmed it, which is why `last_reviewed_at`
 * being null reads as Unverified forever rather than drifting to Ageing.
 */
export type DocState = "current" | "ageing" | "unverified";

export const STATE_LABEL: Record<DocState, string> = {
  current: "Current",
  ageing: "Ageing",
  unverified: "Unverified",
};

/** What the dot means, for `title` / `aria-label` (§8: never colour-only). */
export const STATE_MEANING: Record<DocState, string> = {
  current: "Current — confirmed recently",
  ageing: "Ageing — nobody has confirmed it in a while",
  unverified: "Unverified — never confirmed, or edited since it last was",
};

export type Stateful = {
  last_reviewed_at: string | null;
  updated_at: string;
  frontmatter: { verify_cadence?: VerifyCadence } | null;
};

/**
 * Slack between "confirmed at" and "written at" before an edit counts as an
 * edit.
 *
 * Confirming a doc writes `last_reviewed_at`, and the `docs_maintain_derived`
 * trigger bumps `updated_at` on that same write, so the two timestamps always
 * land a moment apart — from the app clock and the database clock respectively.
 * Without a window every confirmation would immediately invalidate itself.
 * A minute is far wider than that gap and far narrower than a real edit
 * session.
 */
const CONFIRMATION_WINDOW_MS = 60_000;

/** Whether the doc has been edited since someone last confirmed it. */
export function editedSinceConfirmed(doc: Stateful): boolean {
  if (!doc.last_reviewed_at) return false;
  const confirmed = Date.parse(doc.last_reviewed_at);
  const written = Date.parse(doc.updated_at);
  if (Number.isNaN(confirmed) || Number.isNaN(written)) return false;
  return written - confirmed > CONFIRMATION_WINDOW_MS;
}

/**
 * A doc's state. **The** definition — every surface calls this, so they cannot
 * disagree about whether the same doc is Current.
 */
export function docState(doc: Stateful): DocState {
  // Never confirmed by anyone. Imports, agent drafts and docs waiting on a
  // checker all land here, and none of them age: nothing was ever true to
  // begin with, so there is nothing to go stale.
  if (!doc.last_reviewed_at) return "unverified";
  // Confirmed, then changed. The confirmation was about the old words.
  if (editedSinceConfirmed(doc)) return "unverified";
  // Confirmed and held to a cadence it has now outrun.
  if (isDocOverdue(doc)) return "ageing";
  return "current";
}

/**
 * Whether a doc is published — i.e. whether it has a state at all.
 *
 * An unpublished doc lives in `/drafts`, is invisible to everyone but its
 * author, and shows no status anywhere (§3.2). Callers render `<Status>` only
 * for published docs.
 */
export function isPublished(status: DocStatus): boolean {
  return status !== "draft";
}
