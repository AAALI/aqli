"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

/**
 * The mermaid diagram node view, in its own module so it can be loaded with
 * `next/dynamic({ ssr: false })`.
 *
 * Mermaid was already imported lazily inside the effect below, so it has never
 * run on the server — but Next still emitted an SSR copy of the chunk, and
 * OpenNext bundled it into the Worker. Mermaid and its dependency tree
 * (cytoscape, katex, dagre, d3) came to 3.2 MiB of a Worker with a 3 MiB
 * compressed ceiling, to render diagrams that only ever render in a browser.
 *
 * Keeping this component in a separate file is what makes `ssr: false`
 * possible: the flag excludes a module from the server graph, and it can only
 * do that if the module is not also the one exporting the Tiptap extension.
 */

export default function MermaidView({ node, editor }: NodeViewProps) {
  const editable = editor.isEditable;
  const code = node.textContent;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Show the source alongside the preview while editing.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    // Clearing the timer only cancels a render that has not started. Once the
    // callback is running, nothing can stop it — so a run that has been
    // superseded has to be stopped from writing state instead.
    //
    // Without this the preview can end up showing a different diagram from the
    // source. The first keystroke's run waits on the mermaid chunk download;
    // the next one finds it cached and finishes first; then the first resolves
    // and overwrites the newer SVG with the older one.
    let superseded = false;

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      if (!code.trim()) {
        if (superseded) return;
        setSvg(null);
        setError(null);
        return;
      }
      try {
        const mermaid = (await import("mermaid")).default;
        if (superseded) return;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          fontFamily: "var(--font-sans, sans-serif)",
        });
        // parse() first so a half-typed diagram fails cleanly without
        // mermaid.render() leaving orphaned error nodes in the DOM.
        await mermaid.parse(code);
        const { svg } = await mermaid.render(`mermaid-${reactId}-${Date.now()}`, code);
        if (superseded) return;
        setSvg(svg);
        setError(null);
      } catch (err) {
        if (superseded) return;
        setError(err instanceof Error ? err.message.split("\n")[0] : "Invalid diagram");
      }
    }, editable ? 400 : 0);

    return () => {
      superseded = true;
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [code, editable, reactId]);

  return (
    <NodeViewWrapper
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        margin: "1em 0",
        overflow: "hidden",
        background: "var(--bg-card)",
      }}
    >
      <div
        contentEditable={false}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-sidebar)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Diagram
        {error && (
          <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#993C1D" }}>
            · {error}
          </span>
        )}
      </div>

      {/* Source. In read mode it stays in the DOM (Tiptap needs the content
          mounted) but is hidden — readers see only the diagram. */}
      <pre
        style={
          editable
            ? { margin: 0, borderRadius: 0, fontSize: 13 }
            : { position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", margin: 0 }
        }
      >
        <NodeViewContent as={"code" as "div"} className="language-mermaid" />
      </pre>

      {svg && !error && (
        <div
          contentEditable={false}
          style={{ padding: "16px 12px", display: "flex", justifyContent: "center", overflowX: "auto" }}
          // mermaid.render output with securityLevel "strict" (the default)
          // sanitizes the diagram text, so this is safe to inject.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {!svg && !error && !code.trim() && (
        <div contentEditable={false} style={{ padding: "14px 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
          Type Mermaid syntax above — the preview renders here.
        </div>
      )}
    </NodeViewWrapper>
  );
}
