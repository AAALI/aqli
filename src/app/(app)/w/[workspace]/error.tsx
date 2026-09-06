"use client";

import { useEffect } from "react";
import { IconWarn } from "@/components/aqli/icons";

/**
 * The last resort under `/w/*`.
 *
 * The pages that read the database check for schema drift themselves and
 * render `SchemaBehind`, because only the server still has the database's
 * message — Next replaces it with a digest before this boundary runs. So this
 * screen cannot say *what* went wrong, and does not pretend to. It says where
 * to look instead, which is the one thing the stock "This page couldn't load"
 * withheld.
 */
export default function WorkspaceError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[aqli] workspace route error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 480 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "var(--stale-bg, #fef9c3)",
            color: "var(--stale-border, #a16207)",
            marginBottom: 18,
          }}
        >
          <IconWarn size={19} />
        </span>

        <h1
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 30,
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
            color: "var(--text-primary)",
          }}
        >
          This page didn&apos;t load
        </h1>

        <p
          style={{
            margin: "0 0 6px",
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          Something failed on the server while building this page. Retrying is worth a
          go; if it keeps happening, Settings → Health reports whether this
          installation is in the state the code expects.
        </p>

        {error.digest && (
          <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "var(--text-muted)" }}>
            Reference <code style={{ fontFamily: "var(--font-mono)" }}>{error.digest}</code> — it
            appears next to the stack trace in the server logs.
          </p>
        )}

        <button
          type="button"
          onClick={() => unstable_retry()}
          className="btn btn-primary"
          style={{ height: 34, padding: "0 14px" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
