import { AutoApprovedChip, TypeBadge } from "@/components/aqli/badges";
import DocStatusControl from "@/components/docs/DocStatusControl";
import { typeLabel } from "@/lib/doc-display";
import type { DocWithSpace } from "@/types/doc";

/**
 * The document's identity, one line, directly above the `<h1>`.
 *
 * This is document data, not app chrome, so it sits with the document rather
 * than in a band under the top bar. It replaces the editor's full-width
 * `TYPE · STATUS · OWNER · v1 · Last reviewed` strip, and is the single place
 * either surface states the doc's status — the top bar carries save state, the
 * editor's bottom strip restates this same badge, and nothing else does.
 */
export default function DocMetaRow({
  doc,
  version,
  autoApproved = false,
}: {
  doc: DocWithSpace;
  version: number;
  /** Entered as Approved through the GitHub auto-approve path. */
  autoApproved?: boolean;
}) {
  return (
    <div
      className="doc-metarow"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
        flexWrap: "wrap",
      }}
    >
      <TypeBadge type={typeLabel(doc.type)} />
      {autoApproved && <AutoApprovedChip />}
      <DocStatusControl docId={doc.id} status={doc.status} />
      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        v{version}
        {doc.space ? ` · ${doc.space.name}` : ""}
      </span>
    </div>
  );
}
