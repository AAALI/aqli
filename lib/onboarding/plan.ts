/**
 * The rules behind onboarding, kept out of the component so they can be tested.
 *
 * The wizard itself is a thin renderer over this module: it asks `resolveEntry`
 * where to start, `nextStep`/`prevStep` where to go, and `spacesToCreate` what
 * to write. Nothing here touches React, `fetch` or Supabase.
 */

import { slugify } from "@/lib/utils";

/* ───────── Steps ───────── */

export type StepKey = "account" | "workspace" | "spaces" | "assistant";

export type OnboardingStep = {
  key: StepKey;
  label: string;
  hint: string;
};

/**
 * Four steps, and the last one is the last thing that happens.
 *
 * There used to be a fifth, terminal "done" screen: a full-page receipt
 * listing the workspace URL, the spaces and the key — all of which the user
 * had just watched themselves create — behind one "Open workspace" button. It
 * asked nothing and told them nothing new, so finishing setup cost two clicks
 * across two screens instead of one. The arrival moment it was reaching for
 * already exists and is better: a brand-new workspace opens on its own
 * "A clean slate" welcome, in the app, next to the button that writes the
 * first doc.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "account", label: "Account", hint: "Email and password" },
  { key: "workspace", label: "Workspace", hint: "Your company or team" },
  { key: "spaces", label: "Spaces", hint: "How docs are organised" },
  { key: "assistant", label: "AI access", hint: "Optional" },
];

/** Every step is numbered now that none of them is pure ceremony. */
export const NUMBERED_STEPS = ONBOARDING_STEPS;

export function stepIndex(key: StepKey): number {
  return ONBOARDING_STEPS.findIndex((s) => s.key === key);
}

export function nextStep(key: StepKey): StepKey {
  const i = stepIndex(key);
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)].key;
}

export function prevStep(key: StepKey): StepKey {
  const i = stepIndex(key);
  return ONBOARDING_STEPS[Math.max(i - 1, 0)].key;
}

/** "Step 2 of 4". */
export function stepEyebrow(key: StepKey): string | null {
  const i = NUMBERED_STEPS.findIndex((s) => s.key === key);
  return i === -1 ? null : `Step ${i + 1} of ${NUMBERED_STEPS.length}`;
}

/** The last step — the one whose primary action leaves onboarding entirely. */
export function isFinalStep(key: StepKey): boolean {
  return key === ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].key;
}

/* ───────── Workspace slug ───────── */

/**
 * Slugs that would read as a broken URL or collide with a route segment under
 * `/w/`. `workspaces.slug` is globally unique, so these are worth refusing up
 * front rather than at the database.
 */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "docs",
  "drafts",
  "invite",
  "login",
  "new",
  "review",
  "search",
  "settings",
  "signup",
  "stale",
  "static",
  "support",
  "w",
  "www",
]);

export const SLUG_MIN = 2;
export const SLUG_MAX = 48;

export type SlugCheck = { ok: true } | { ok: false; reason: string };

export function normalizeSlug(input: string): string {
  return slugify(input).slice(0, SLUG_MAX);
}

/** The slug we propose from a workspace name, before the user edits it. */
export function suggestSlug(name: string): string {
  return normalizeSlug(name);
}

export function validateSlug(slug: string): SlugCheck {
  if (slug.length === 0) return { ok: false, reason: "Pick a workspace URL." };
  if (slug.length < SLUG_MIN)
    return { ok: false, reason: `At least ${SLUG_MIN} characters.` };
  if (slug.length > SLUG_MAX)
    return { ok: false, reason: `At most ${SLUG_MAX} characters.` };
  if (slug !== slugify(slug))
    return { ok: false, reason: "Lowercase letters, numbers and dashes only." };
  if (RESERVED_SLUGS.has(slug))
    return { ok: false, reason: `"${slug}" is reserved. Try something else.` };
  return { ok: true };
}

/**
 * Alternatives to offer when a slug is taken. `workspaces.slug` is unique
 * across the whole install, so "acme" is gone the moment one team takes it —
 * the previous wizard surfaced that as an unexplained "Could not create
 * workspace" and left the user with nowhere to go.
 *
 * `seed` is only read when the numbered suffixes are exhausted, so the common
 * case stays deterministic and testable.
 */
export function slugAlternatives(
  base: string,
  taken: Iterable<string>,
  seed = () => Math.random().toString(36).slice(2, 6),
): string[] {
  const used = new Set(taken);
  const root = normalizeSlug(base) || "workspace";
  const out: string[] = [];

  for (const candidate of [`${root}-hq`, `${root}-team`, `${root}-2`]) {
    const slug = normalizeSlug(candidate);
    if (!used.has(slug) && validateSlug(slug).ok && !out.includes(slug)) {
      out.push(slug);
    }
    if (out.length === 3) return out;
  }

  while (out.length < 3) {
    const slug = normalizeSlug(`${root}-${seed()}`);
    if (!used.has(slug) && validateSlug(slug).ok && !out.includes(slug)) {
      out.push(slug);
    } else if (out.length === 0 && used.size > 500) {
      break; // pathological input — better to show nothing than to spin
    }
  }

  return out;
}

/* ───────── Spaces ───────── */

export type SpaceSuggestion = {
  emoji: string;
  name: string;
  desc: string;
};

/**
 * Team-neutral by design (roadmap phase 1): a Head of People has to see
 * themselves in this list, so Engineering sits among the others rather than
 * leading. "Company" is seeded by `create_workspace_for_user`, so it always
 * arrives already created.
 */
export const SUGGESTED_SPACES: SpaceSuggestion[] = [
  { emoji: "🏢", name: "Company", desc: "Handbook, policies, onboarding" },
  { emoji: "🤝", name: "People", desc: "Hiring, benefits, culture" },
  { emoji: "📣", name: "Marketing", desc: "Campaigns, brand, content" },
  { emoji: "💼", name: "Sales", desc: "Playbooks, pricing, FAQs" },
  { emoji: "🧭", name: "Product", desc: "Roadmap, specs, decisions" },
  { emoji: "🔧", name: "Ops", desc: "Processes, vendors, reports" },
  { emoji: "⚙️", name: "Engineering", desc: "Technical docs, runbooks" },
];

export const CUSTOM_SPACE_EMOJI = "📁";

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Toggle a space in the picked set. Spaces that already exist are locked —
 * unticking one would imply a delete that this screen does not perform.
 */
export function toggleSpace(
  picked: string[],
  name: string,
  existing: string[],
): string[] {
  if (existing.some((e) => sameName(e, name))) return picked;
  return picked.some((p) => sameName(p, name))
    ? picked.filter((p) => !sameName(p, name))
    : [...picked, name];
}

/** Whether a typed custom name is worth adding — non-empty and not a duplicate. */
export function canAddCustomSpace(name: string, known: string[]): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (!slugify(trimmed)) return false; // e.g. "!!!" — would slug to nothing
  return !known.some((k) => sameName(k, trimmed));
}

/**
 * The spaces the wizard must actually POST: everything picked that does not
 * exist yet, carrying the right icon and a slug the caller can send as-is.
 */
export function spacesToCreate(
  picked: string[],
  existing: string[],
  custom: string[],
): { name: string; slug: string; icon: string }[] {
  const seen = new Set(existing.map((e) => slugify(e)));
  const out: { name: string; slug: string; icon: string }[] = [];

  for (const name of picked) {
    const slug = slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const suggestion = SUGGESTED_SPACES.find((s) => sameName(s.name, name));
    const isCustom = custom.some((c) => sameName(c, name));
    out.push({
      name: name.trim(),
      slug,
      icon: suggestion && !isCustom ? suggestion.emoji : CUSTOM_SPACE_EMOJI,
    });
  }

  return out;
}

/* ───────── Where to start ───────── */

/** Written into `workspaces.settings` the moment onboarding is finished. */
export const ONBOARDED_AT = "onboarded_at";

export type EntryState = {
  hasUser: boolean;
  /** Workspaces the signed-in user belongs to, oldest first. */
  workspaces: { id: string; slug: string; name: string }[];
  /** Spaces in `workspaces[0]`, when known. */
  spaceCount?: number;
  /**
   * `settings.onboarded_at` on `workspaces[0]` — the definitive answer, set
   * when a run of this wizard finishes.
   */
  onboardedAt?: string | null;
  /** Whether `workspaces[0]` holds any docs. Evidence for workspaces that
   *  predate `onboarded_at` and so can never carry it. */
  hasDocs?: boolean;
};

export type Entry =
  | { kind: "step"; step: StepKey }
  | { kind: "resume"; step: StepKey; workspace: { id: string; slug: string; name: string } }
  | { kind: "redirect"; to: string };

/**
 * Has this workspace been through setup?
 *
 * "Holds only its seeded Company space" was the old test, and it cannot tell
 * *"they abandoned setup halfway"* from *"they finished, and Company was all
 * they wanted"*. Getting that second case wrong sends a finished user back
 * into onboarding every time they open /signup.
 *
 * So finishing is recorded rather than inferred: `finish()` stamps
 * `settings.onboarded_at`, and that is the answer whenever it exists. The two
 * fallbacks are only for workspaces created before the stamp existed, which
 * can never carry it — more than the seeded space, or any doc at all, means
 * somebody has been using this workspace and does not need setting up.
 */
function isOnboarded(state: EntryState): boolean {
  if (state.onboardedAt) return true;
  if ((state.spaceCount ?? 0) > 1) return true;
  return state.hasDocs === true;
}

/**
 * Decides where an arriving user belongs.
 *
 * The old wizard kept every scrap of progress in React state, so a refresh —
 * or the round trip through a confirmation email — dropped the user back on
 * the workspace step with no memory that they had already created one.
 * Retrying the same name then hit the unique constraint on `workspaces.slug`
 * and the flow dead-ended. Progress is therefore re-derived from the server on
 * every mount instead of being remembered.
 *
 * A workspace that has been through setup sends the user to the app —
 * visiting /signup again should never ask an existing customer to create a
 * second workspace, nor walk them back through steps they have finished. One
 * that has not resumes at the spaces step, which is where a run that was
 * interrupted after workspace creation left off.
 */
export function resolveEntry(state: EntryState): Entry {
  if (!state.hasUser) return { kind: "step", step: "account" };

  const workspace = state.workspaces[0];
  if (!workspace) return { kind: "step", step: "workspace" };

  if (isOnboarded(state)) return { kind: "redirect", to: `/w/${workspace.slug}` };

  return { kind: "resume", step: "spaces", workspace };
}
