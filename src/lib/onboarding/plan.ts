/**
 * The rules behind onboarding, kept out of the component so they can be tested.
 *
 * The wizard itself is a thin renderer over this module: it asks `resolveEntry`
 * where to start, `nextStep`/`prevStep` where to go, and `spacesToCreate` what
 * to write. Nothing here touches React, `fetch` or Supabase.
 */

import { slugify } from "@/lib/utils";

/* ───────── Steps ───────── */

export type StepKey = "account" | "workspace" | "spaces";

export type OnboardingStep = {
  key: StepKey;
  label: string;
  hint: string;
};

/**
 * Three steps, then a cursor (v3 §5.1–5.3, J1).
 *
 * Account, workspace, spaces. The old fourth step — AI access — moved to
 * Settings, where it is optional forever and in nobody's way; the receipt
 * screen that used to follow it went before that. The last step's primary
 * action is "Start writing", and it lands on the editor.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "account", label: "Account", hint: "Email and password" },
  { key: "workspace", label: "Workspace", hint: "Your company or team" },
  { key: "spaces", label: "Spaces", hint: "Optional" },
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

/** "Step 2 of 3"; the last one says it is optional, because it is. */
export function stepEyebrow(key: StepKey): string | null {
  const i = NUMBERED_STEPS.findIndex((s) => s.key === key);
  if (i === -1) return null;
  return `Step ${i + 1} of ${NUMBERED_STEPS.length}${key === "spaces" ? " · optional" : ""}`;
}

/**
 * The workspace name, pre-filled from the email domain (v3 §5.2):
 * ali@1989.studio → "1989 Studio". A personal mailbox says nothing about a
 * company, so it gets "Ali's workspace" instead.
 */
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com",
  "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "fastmail.com", "hey.com",
]);

export function workspaceNameFromEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const person = local.split(/[._+-]/)[0] ?? "";
  const personName = person ? person[0].toUpperCase() + person.slice(1) : "";
  if (!domain || PERSONAL_DOMAINS.has(domain)) return personName ? `${personName}'s workspace` : "";
  const parts = domain.split(".");
  // Drop the TLD, and a second-level suffix like co.uk.
  const core = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts.slice(0, -2) : parts.slice(0, -1);
  const words = (core.length ? core : parts).join(" ").split(/[-_\s]+/).filter(Boolean);
  const tld = parts[parts.length - 1];
  // A brand that *is* its TLD ("1989.studio") keeps it as a word.
  if (words.length === 1 && /^\d+$/.test(words[0])) words.push(tld);
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
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
  /** A key understood by `components/aqli/SpaceIcon`. */
  icon: string;
  name: string;
  desc: string;
};

/**
 * In the order frame 03 draws them, with the line icons that replaced the
 * emoji defaults. "Company" is seeded by `create_workspace_for_user`, so it
 * always arrives already created — and is enough on its own.
 */
export const SUGGESTED_SPACES: SpaceSuggestion[] = [
  { icon: "book", name: "Company", desc: "Handbook, policies, onboarding" },
  { icon: "flag", name: "Product", desc: "Roadmap, specs, decisions" },
  { icon: "gear", name: "Engineering", desc: "Technical docs, runbooks" },
  { icon: "users", name: "People", desc: "Hiring, benefits, culture" },
  { icon: "table", name: "Sales", desc: "Playbooks, pricing, FAQs" },
  { icon: "chat", name: "Marketing", desc: "Campaigns, brand, content" },
  { icon: "archive", name: "Ops", desc: "Processes, vendors, reports" },
];

export const CUSTOM_SPACE_ICON = "folder";

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
      icon: suggestion && !isCustom ? suggestion.icon : CUSTOM_SPACE_ICON,
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
