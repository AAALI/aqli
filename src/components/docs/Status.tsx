import { docState, STATE_LABEL, STATE_MEANING, type DocState, type Stateful } from "@/lib/doc-status";

/**
 * The doc's state, everywhere it appears (v3 §3).
 *
 * One component, two forms, no variants: the pill where there is room for a
 * word, the bare dot in dense rows and on the phone. There is no third form
 * and no per-surface styling — a doc that reads Ageing on Home reads Ageing in
 * search, in the sidebar and in its own history, in the same colours, at the
 * same size.
 *
 * It is deliberately read-only. Nothing in v3 sets a doc's status from a
 * dropdown; state is a consequence of publishing, confirming and editing.
 */
export default function Status({
  doc,
  state,
  form = "pill",
  className,
}: {
  /** Pass the doc and let it derive the state — the usual call. */
  doc?: Stateful;
  /** Or pass a state already computed on the server. */
  state?: DocState;
  form?: "pill" | "dot";
  className?: string;
}) {
  const s = state ?? (doc ? docState(doc) : "unverified");

  if (form === "dot") {
    return (
      <span
        className={`sdot sdot-${s}${className ? ` ${className}` : ""}`}
        role="img"
        aria-label={STATE_LABEL[s]}
        title={STATE_MEANING[s]}
      />
    );
  }

  return (
    <span className={`tl tl-${s}${className ? ` ${className}` : ""}`} title={STATE_MEANING[s]}>
      <i aria-hidden="true" />
      {STATE_LABEL[s]}
    </span>
  );
}
