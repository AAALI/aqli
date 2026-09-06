"use client";

import dynamic from "next/dynamic";
import CodeBlock from "@tiptap/extension-code-block";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

/**
 * Diagrams render in the browser and only in the browser, so mermaid has no
 * business in the Worker. `ssr: false` keeps the whole tree — mermaid,
 * cytoscape, katex, dagre, d3 — out of the server bundle.
 */
const MermaidView = dynamic(() => import("./MermaidView"), {
  ssr: false,
  loading: () => (
    <NodeViewWrapper>
      <pre style={{ margin: "1em 0", fontSize: 13, opacity: 0.6 }}>
        <NodeViewContent as={"code" as "div"} className="language-mermaid" />
      </pre>
    </NodeViewWrapper>
  ),
});

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
