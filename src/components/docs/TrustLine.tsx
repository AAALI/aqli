"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheckCircle, IconWarn, IconHistory, IconShield } from "@/components/aqli/icons";
import { formatRelative } from "@/lib/utils";
import { CADENCE_LABEL, CADENCES, type VerifyCadence } from "@/lib/verify-cadence";
import type { DocFrontmatter } from "@/types/doc";

/**
 * Woven maintenance: the freshness line under the title. Reading and
 * re-verifying live on the same surface, so "is this still true?" never
 * requires a trip to a separate dashboard.
 *
 * The default state is *resolved*, not a scold. A verified doc says so in
 * green and offers the cadence it is held to; the old standalone grey banner
 * ("Not verified yet — confirm this is still accurate") that sat between every
 * unverified title and its content is now just the warning variant of this
 * same line, in the same place, with the same controls.
 */
export default function TrustLine({
  docId,
  lastReviewedAt,
  reviewerName,
  stale,
  cadence,
  frontmatter,
  canEdit,
  prSource,
}: {
  docId: string;
  lastReviewedAt: string | null;
  /** Who last verified it, read from the activity log. */
  reviewerName: string | null;
  /** Computed on the server against the doc's own cadence. */
  stale: boolean;
  cadence: VerifyCadence;
  /** Merged into on save so setting a cadence cannot drop tags. */
  frontmatter: DocFrontmatter;
  canEdit: boolean;
  /** 08c: set when the doc was published by a merged PR — the shield variant. */
  prSource?: { repo: string | null; prNumber: string | null } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draftCadence, setDraftCadence] = useState<VerifyCadence>(cadence);
  const [savingCadence, setSavingCadence] = useState(false);

  const dirty = draftCadence !== cadence;

  async function reverify() {
    setBusy(true);
    try {
      await fetch(`/api/docs/${docId}/reviewed`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveCadence() {
    setSavingCadence(true);
    try {
      await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontmatter: { ...frontmatter, verify_cadence: draftCadence },
        }),
      });
      router.refresh();
    } finally {
      setSavingCadence(false);
    }
  }

  return (
    <div className={`trust${stale ? " warn" : ""}`}>
      <span style={{ display: "inline-flex", flex: "0 0 auto" }}>
        {stale ? (
          <IconWarn size={14} />
        ) : prSource ? (
          <IconShield size={14} sw={1.7} />
        ) : (
          <IconCheckCircle size={14} sw={1.8} />
        )}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        {prSource && !stale ? (
          <>
            Verified by PR review
            {prSource.repo ? ` — merged in ${prSource.repo}` : ""}
            {prSource.prNumber ? ` #${prSource.prNumber}` : ""}
            {lastReviewedAt ? ` · ${formatRelative(lastReviewedAt)}` : ""}
          </>
        ) : lastReviewedAt ? (
          <>
            {stale ? "Last verified " : "Verified "}
            {formatRelative(lastReviewedAt)}
            {reviewerName ? ` by ${reviewerName}` : ""}
            {stale ? " — due for a check" : ""}
          </>
        ) : (
          "Never verified — confirm this is still accurate"
        )}
      </span>

      {/* The cadence this doc is held to. Editable in place: deciding how often
          something needs re-checking is part of reading it, not a settings trip. */}
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          flex: "0 0 auto",
        }}
      >
        <span style={{ opacity: 0.8 }}>cadence</span>
        <select
          value={draftCadence}
          onChange={(e) => setDraftCadence(e.target.value as VerifyCadence)}
          disabled={!canEdit || savingCadence}
          aria-label="How often this doc should be re-verified"
          style={{
            background: "transparent",
            border: 0,
            font: "inherit",
            color: "inherit",
            fontWeight: 500,
            cursor: canEdit ? "pointer" : "default",
            outline: "none",
            padding: 0,
          }}
        >
          {CADENCES.map((c) => (
            <option key={c} value={c}>
              {CADENCE_LABEL[c]}
            </option>
          ))}
        </select>
      </label>

      <span style={{ display: "inline-flex", gap: 4, flex: "0 0 auto" }}>
        {dirty && canEdit && (
          <button
            onClick={saveCadence}
            disabled={savingCadence}
            className="btn btn-primary"
            style={{ height: 24, fontSize: 11.5, padding: "0 10px" }}
          >
            {savingCadence ? "Saving…" : "Save"}
          </button>
        )}
        {canEdit && (
          <button
            onClick={reverify}
            disabled={busy}
            className="btn btn-ghost"
            style={{ height: 24, fontSize: 11.5, padding: "0 8px", gap: 5, color: "inherit" }}
          >
            <IconHistory size={11} />
            {busy ? "Verifying…" : "Re-verify"}
          </button>
        )}
      </span>
    </div>
  );
}
