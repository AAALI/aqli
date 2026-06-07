import type { DocType } from "@/types/doc";

type TiptapDoc = { type: "doc"; content: unknown[] };

const h = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const li = (text: string) => ({ type: "listItem", content: [p(text)] });
const ul = (...items: string[]) => ({ type: "bulletList", content: items.map(li) });
const ol = (...items: string[]) => ({ type: "orderedList", content: items.map(li) });

/**
 * Pre-populated editor content per doc type. Used when a new doc is created so
 * the author starts from the team's structure rather than a blank page.
 * `general` intentionally has no template.
 */
export const DOC_TEMPLATES: Partial<Record<DocType, TiptapDoc>> = {
  prd: {
    type: "doc",
    content: [
      h(1, "Product Requirements Document"),
      h(2, "Overview"),
      p("Describe what this feature does and why it exists."),
      h(2, "Goals"),
      ul("Goal 1", "Goal 2"),
      h(2, "Non-Goals"),
      p("What this feature explicitly does not do."),
      h(2, "User Flow"),
      p("Step-by-step description of the user journey."),
      h(2, "Error States"),
      p("How errors and edge cases are handled."),
      h(2, "Open Questions"),
      p("Unresolved questions that need answers before shipping."),
    ],
  },
  adr: {
    type: "doc",
    content: [
      h(1, "Architecture Decision Record"),
      h(2, "Context"),
      p("What is the situation that requires a decision?"),
      h(2, "Decision"),
      p("What was decided?"),
      h(2, "Options Considered"),
      p("What alternatives were evaluated?"),
      h(2, "Consequences"),
      p("What are the trade-offs and implications?"),
    ],
  },
  runbook: {
    type: "doc",
    content: [
      h(1, "Runbook"),
      h(2, "Purpose"),
      p("What does this runbook cover?"),
      h(2, "Prerequisites"),
      p("What access and tools are needed?"),
      h(2, "Steps"),
      ol("Step 1", "Step 2"),
      h(2, "Rollback"),
      p("How to undo this process if something goes wrong."),
    ],
  },
  fix_note: {
    type: "doc",
    content: [
      h(1, "Fix Note"),
      h(2, "What was fixed"),
      p("Describe the bug or issue that was resolved."),
      h(2, "Root cause"),
      p("Why did this happen?"),
      h(2, "Change made"),
      p("What code or config was changed?"),
      h(2, "Testing"),
      p("How was the fix verified?"),
    ],
  },
  compliance: {
    type: "doc",
    content: [
      h(1, "Compliance Document"),
      h(2, "Regulatory Reference"),
      p("Cite the specific rule, regulation, or internal policy."),
      h(2, "Requirement"),
      p("What must the product or process do to comply?"),
      h(2, "Implementation"),
      p("How is this requirement implemented in the product?"),
      h(2, "Evidence"),
      p("What evidence demonstrates compliance?"),
      h(2, "Review cadence"),
      p("How often must this be reviewed and by whom?"),
    ],
  },
  decision: {
    type: "doc",
    content: [
      h(1, "Decision"),
      h(2, "Background"),
      p("What context led to this decision?"),
      h(2, "Decision"),
      p("What was decided, by whom, and when?"),
      h(2, "Rationale"),
      p("Why was this the right call?"),
      h(2, "Impact"),
      p("What changes as a result of this decision?"),
    ],
  },
};

export function templateFor(type: DocType): TiptapDoc | null {
  return DOC_TEMPLATES[type] ?? null;
}
