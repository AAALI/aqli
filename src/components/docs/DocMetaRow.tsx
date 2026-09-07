import { TypeBadge } from "@/components/aqli/badges";
import Status from "@/components/docs/Status";
import { typeLabel } from "@/lib/doc-display";
import { isPublished } from "@/lib/doc-status";
import type { DocWithSpace } from "@/types/doc";

/**
 * The document's identity, one line, directly above the `<h1>`.
 *
 * This is document data, not app chrome, so it sits with the document rather
 * than in a band under the top bar. It replaces the editor's full-width
 * `TYPE · STATUS · OWNER · v1 · Last reviewed` strip, and is the single place
 * either surface states the doc's status, and it states it read-only: nothing
 * in v3 sets a status from a dropdown. State is a consequence of publishing,
 * confirming and editing.
 */
export default function DocMetaRow({
  doc,
  version,
}: {
  doc: DocWithSpace;
  version: number;
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
      {isPublished(doc.status) && <Status doc={doc} />}
      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        v{version}
        {doc.space ? ` · ${doc.space.name}` : ""}
      </span>
    </div>
  );
}
