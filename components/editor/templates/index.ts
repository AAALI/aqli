import type { DocType } from "@/types/doc";

type TiptapDoc = { type: "doc"; content: unknown[] };

/**
 * One expected section of a doc type.
 *
 * `hint` is guidance for the author — it is deliberately **not** document
 * content. Templates used to seed the prompt straight into the body as a
 * paragraph ("What are we trying to achieve, and how will we know it worked?"),
 * which meant an unfilled doc rendered its own scaffolding to readers as if it
 * were prose. The hint now travels with the outline instead: the editor shows
 * it against an empty section, and the reader never sees it at all.
 */
export type TemplateSection = { heading: string; hint: string };

/**
 * The section structure of each doc type. `general` intentionally has none —
 * a blank page is the point.
 */
export const DOC_TEMPLATE_SECTIONS: Partial<Record<DocType, TemplateSection[]>> = {
  how_to: [
    { heading: "What this covers", hint: "What task does this guide help someone complete?" },
    { heading: "Before you start", hint: "Access, tools, or context needed." },
    { heading: "Steps", hint: "The procedure, in order." },
    { heading: "Common problems", hint: "What usually goes wrong, and what to do about it." },
  ],
  policy: [
    { heading: "What this policy covers", hint: "Who and what this applies to." },
    { heading: "The policy", hint: "The rules, stated plainly." },
    { heading: "Exceptions", hint: "When the rules don't apply, and who can approve an exception." },
    { heading: "Who to ask", hint: "The owner of this policy and where to raise questions." },
  ],
  meeting: [
    { heading: "Attendees & date", hint: "Who was there, and when." },
    { heading: "What we discussed", hint: "The topics covered." },
    { heading: "Decisions", hint: "What was decided." },
    { heading: "Action items", hint: "Owner and action, one per line." },
  ],
  brief: [
    { heading: "Objective", hint: "What are we trying to achieve, and how will we know it worked?" },
    { heading: "Audience", hint: "Who this is for." },
    { heading: "Key message", hint: "The one thing that must land." },
    { heading: "Deliverables & timeline", hint: "Deliverable, owner, and date." },
    { heading: "Budget & owners", hint: "Resources and who's responsible." },
  ],
  prd: [
    { heading: "Overview", hint: "What this feature does and why it exists." },
    { heading: "Goals", hint: "What success looks like." },
    { heading: "Non-goals", hint: "What this feature explicitly does not do." },
    { heading: "User flow", hint: "Step-by-step description of the user journey." },
    { heading: "Error states", hint: "How errors and edge cases are handled." },
    { heading: "Open questions", hint: "Unresolved questions that need answers before shipping." },
  ],
  adr: [
    { heading: "Context", hint: "What is the situation that requires a decision?" },
    { heading: "Decision", hint: "What was decided?" },
    { heading: "Options considered", hint: "What alternatives were evaluated?" },
    { heading: "Consequences", hint: "What are the trade-offs and implications?" },
  ],
  runbook: [
    { heading: "Purpose", hint: "What does this runbook cover?" },
    { heading: "Prerequisites", hint: "What access and tools are needed?" },
    { heading: "Steps", hint: "The procedure, in order." },
    { heading: "Rollback", hint: "How to undo this process if something goes wrong." },
  ],
  fix_note: [
    { heading: "What was fixed", hint: "The bug or issue that was resolved." },
    { heading: "Root cause", hint: "Why did this happen?" },
    { heading: "Change made", hint: "What code or config was changed?" },
    { heading: "Testing", hint: "How was the fix verified?" },
  ],
  compliance: [
    { heading: "Regulatory reference", hint: "Cite the specific rule, regulation, or internal policy." },
    { heading: "Requirement", hint: "What must the product or process do to comply?" },
    { heading: "Implementation", hint: "How is this requirement implemented in the product?" },
    { heading: "Evidence", hint: "What evidence demonstrates compliance?" },
    { heading: "Review cadence", hint: "How often must this be reviewed and by whom?" },
  ],
  decision: [
    { heading: "Background", hint: "What context led to this decision?" },
    { heading: "Decision", hint: "What was decided, by whom, and when?" },
    { heading: "Rationale", hint: "Why was this the right call?" },
    { heading: "Impact", hint: "What changes as a result of this decision?" },
  ],
};

/**
 * The seeded body for a new doc: the section headings and nothing else.
 *
 * No title heading — the document already has a title, and a generic "Brief"
 * h1 only competed with it. No prompt paragraphs either; see `TemplateSection`.
 */
export function templateFor(type: DocType): TiptapDoc | null {
  const sections = DOC_TEMPLATE_SECTIONS[type];
  if (!sections) return null;
  return {
    type: "doc",
    content: sections.flatMap((s) => [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: s.heading }] },
      { type: "paragraph" },
    ]),
  };
}

/** The headings a doc of this type is expected to carry, in order. */
export function expectedSections(type: DocType): TemplateSection[] {
  return DOC_TEMPLATE_SECTIONS[type] ?? [];
}

/** Loose match so "Open Questions" and "Open questions" are the same section. */
export function normalizeHeading(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
