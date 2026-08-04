"use client";

import { useEffect, useId, useRef, useState } from "react";
import CodeBlock from "@tiptap/extension-code-block";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

/**
 * Drop-in replacement for StarterKit's codeBlock that renders
 * `language: "mermaid"` blocks as diagrams. Any other language renders as a
 * plain code block. Because diagrams live in ordinary code fences, they
 * round-trip through body_md untouched — agents write ```mermaid in markdown
 * and it just works.
 *
 * Use with StarterKit.configure({ codeBlock: false }).
 */
export const CodeBlockWithMermaid = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({ languageClassPrefix: "language-" });

/** Starter snippet inserted by the /diagram slash command. */
export const MERMAID_TEMPLATE = `flowchart TD
  A[Start] --> B{Decision}
  B -- Yes --> C[Do the thing]
  B -- No --> D[Write down why not]`;

function CodeBlockView(props: NodeViewProps) {
  const language = (props.node.attrs.language as string | null) ?? null;
  if (language === "mermaid") return <MermaidView {...props} />;
  return (
    <NodeViewWrapper>
      <pre>
        <NodeViewContent as={"code" as "div"} className={language ? `language-${language}` : undefined} />
      </pre>
    </NodeViewWrapper>
  );
}

function MermaidView({ node, editor }: NodeViewProps) {
  const editable = editor.isEditable;
  const code = node.textContent;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Show the source alongside the preview while editing.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      if (!code.trim()) {
        setSvg(null);
        setError(null);
        return;
      }
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          fontFamily: "var(--font-sans, sans-serif)",
        });
        // parse() first so a half-typed diagram fails cleanly without
        // mermaid.render() leaving orphaned error nodes in the DOM.
        await mermaid.parse(code);
        const { svg } = await mermaid.render(`mermaid-${reactId}-${Date.now()}`, code);
        setSvg(svg);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message.split("\n")[0] : "Invalid diagram");
      }
    }, editable ? 400 : 0);
    return () => {
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
