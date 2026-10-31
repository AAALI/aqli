"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SpaceIcon from "@/components/aqli/SpaceIcon";
import { avatarColor } from "@/lib/utils";
import type { Space } from "@/types/space";
import type { DocClass } from "@/types/doc";

export type Checker = { id: string; name: string };

/**
 * Every process question, asked once (v3 §4).
 *
 * This sheet is the other half of the writing surface: everything v3 took off
 * the page — where it lives, who should confirm it — reappears here, at the
 * moment those answers are actually known. A writer who never publishes never
 * sees any of it.
 *
 * Two fields, not three. The prototype and frame 22 both ask only where it
 * lives and who should check it; doc type is carried from the pattern the
 * writer started with, rather than putting eleven more chips in a 440px sheet.
 */
export default function PublishSheet({
  title,
  spaces,
  people,
  initialSpaceId,
  docClass = "canon",
  busy,
  error,
  onCancel,
  onPublish,
}: {
  title: string;
  spaces: Space[];
  people: Checker[];
  initialSpaceId: string | null;
  docClass?: DocClass;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onPublish: (choice: { spaceId: string | null; checkerIds: string[] }) => void;
}) {
  // Mounted only while open (the caller gates it), so these initialise fresh
  // every time the sheet is raised — no effect syncing them back to the props.
  const [spaceId, setSpaceId] = useState<string | null>(initialSpaceId ?? spaces[0]?.id ?? null);
  const [checkerIds, setCheckerIds] = useState<string[]>([]);
  const requiresReview = docClass !== "record" && spaces.find((s) => s.id === spaceId)?.review_policy === "review_all";

  const chosen = useMemo(
    () => people.filter((p) => checkerIds.includes(p.id)).map((p) => p.name),
    [people, checkerIds],
  );

  const toggleChecker = useCallback((id: string) => {
    setCheckerIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }, []);

  // ⌘⏎ from inside the sheet publishes; Esc closes it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onCancel();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy && !requiresReview) {
        e.preventDefault();
        onPublish({ spaceId, checkerIds });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, requiresReview, spaceId, checkerIds, onCancel, onPublish]);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Publish">
        <div className="sheet-h">
          <h3>Publish “{title || "Untitled"}”</h3>
          <p>It becomes findable by everyone in the workspace, and readable by your AI agents.</p>
        </div>

        <div className="sheet-b">
          <div>
            <span className="fl">Where it lives</span>
            <div className="pickrow">
              {spaces.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  aria-pressed={spaceId === s.id}
                  className={`pick${spaceId === s.id ? " is-on" : ""}`}
                  disabled={busy}
                  onClick={() => setSpaceId(s.id)}
                >
                  <span className="em"><SpaceIcon icon={s.icon} /></span>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {people.length > 0 && (
            <div>
              <span className="fl">
                Ask someone to check it{" "}
                <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", fontSize: 11.5 }}>
                  — optional
                </span>
              </span>
              <div className="pickrow">
                {people.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    aria-pressed={checkerIds.includes(p.id)}
                    className={`pick${checkerIds.includes(p.id) ? " is-on" : ""}`}
                    disabled={busy}
                    onClick={() => toggleChecker(p.id)}
                  >
                    <span
                      className="avatar avatar-sm"
                      style={{ background: avatarColor(p.name), width: 20, height: 20, flexBasis: 20, fontSize: 9 }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "var(--ageing-text)" }}>
              {error}
            </p>
          )}
          {requiresReview && (
            <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--ageing-text)" }}>
              This space requires review. Direct publishing is unavailable. Choose another space or keep this as a draft.
            </p>
          )}
        </div>

        <div className="sheet-f">
          {/* The consequence, in the same words the trust line will use. */}
          <span className="hint">
            {requiresReview ? (
              <>Keep as a draft until it can be sent for review.</>
            ) : chosen.length > 0 ? (
              <>
                Publishes now.{" "}
                <b style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{listNames(chosen)}</b>{" "}
                will be asked to check it.
              </>
            ) : (
              <>Publishes now, confirmed by you.</>
            )}
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || requiresReview}
            onClick={() => onPublish({ spaceId, checkerIds })}
          >
            {busy ? "Publishing…" : "Publish"}
            {!busy && (
              <span
                className="kbd"
                style={{ borderColor: "rgba(255,255,255,.3)", color: "rgba(255,255,255,.75)", marginLeft: 3 }}
              >
                ⌘⏎
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Sara", "Sara and Khalid", "Sara, Khalid and Yara". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
