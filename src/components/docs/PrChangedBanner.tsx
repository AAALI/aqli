import { IconGitMerge, IconArrowUpRight } from "@/components/aqli/icons";
import { formatRelative } from "@/lib/utils";

/**
 * 08c: on a PR-sourced doc, state what the merge did to this doc — the
 * reader-side counterpart of the auto-approve policy. Server-rendered from
 * the doc's github_pr activity metadata.
 */
export default function PrChangedBanner({
  prUrl,
  repo,
  filesChanged,
  eventAt,
  created,
}: {
  prUrl: string;
  repo: string | null;
  filesChanged: number | null;
  eventAt: string;
  created: boolean;
}) {
  const prNumber = prUrl.match(/\/pull\/(\d+)/)?.[1];
  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12.5,
        padding: "8px 12px",
        background: "var(--approved-bg)",
        border: "1px solid var(--approved-border)",
        borderRadius: 8,
        color: "var(--approved-text)",
      }}
    >
      <span style={{ display: "inline-flex" }}>
        <IconGitMerge size={14} />
      </span>
      <span style={{ color: "var(--text-secondary)" }}>
        <span style={{ color: "var(--approved-text)", fontWeight: 500 }}>
          What this PR changed
        </span>
        {" — "}
        {created ? "this doc was created" : "this doc was updated"} by a merge
        {repo ? ` in ${repo}` : ""}
        {typeof filesChanged === "number" && filesChanged > 0
          ? ` touching ${filesChanged} file${filesChanged === 1 ? "" : "s"}`
          : ""}
        {" · "}
        {formatRelative(eventAt)}
      </span>
      <a
        href={prUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "var(--approved-text)",
          fontWeight: 500,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        View PR{prNumber ? ` #${prNumber}` : ""}
        <IconArrowUpRight size={11} />
      </a>
    </div>
  );
}
