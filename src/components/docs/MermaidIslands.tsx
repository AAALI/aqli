"use client";

import { useEffect } from "react";

/**
 * Turns the mermaid frames in a server-rendered body into diagrams.
 *
 * `renderDocHtml` writes each ```mermaid fence as a `.mmd` frame holding the
 * source. This is the only JavaScript the reading surface needs for them: when
 * a frame scrolls near the viewport, mermaid (3 MiB of it, with its layout
 * engines) is fetched once and the SVG is drawn into the frame. A document
 * with no diagrams never loads it, and one with a diagram at the bottom does
 * not load it until the reader gets there.
 *
 * The source stays in the DOM, visually hidden once drawn, so the text is
 * still there to select and for the outline's word count.
 */
export default function MermaidIslands({ scope }: { scope: string }) {
  useEffect(() => {
    const root = document.getElementById(scope);
    if (!root) return;
    const frames = Array.from(root.querySelectorAll<HTMLElement>(".mmd[data-mermaid]"));
    if (frames.length === 0) return;

    let cancelled = false;
    let seq = 0;

    async function draw(frame: HTMLElement) {
      const code = frame.querySelector("code")?.textContent ?? "";
      const out = frame.querySelector<HTMLElement>(".mmd-out");
      const err = frame.querySelector<HTMLElement>(".mmd-err");
      if (!out || !code.trim()) return;
      try {
        const mermaid = (await import("mermaid")).default;
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          fontFamily: "var(--font-sans, sans-serif)",
        });
        // parse() first so a broken diagram fails cleanly, without render()
        // leaving its error nodes in the document.
        await mermaid.parse(code);
        const { svg } = await mermaid.render(`mmd-${scope}-${seq++}-${Date.now()}`, code);
        if (cancelled) return;
        // mermaid.render output with securityLevel "strict" (the default)
        // sanitizes the diagram text, so this is safe to inject.
        out.innerHTML = svg;
        frame.classList.add("is-drawn");
      } catch (e) {
        if (cancelled || !err) return;
        err.textContent = ` · ${e instanceof Error ? e.message.split("\n")[0] : "Invalid diagram"}`;
        frame.classList.add("is-broken");
      }
    }

    if (!("IntersectionObserver" in window)) {
      frames.forEach((f) => void draw(f));
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          void draw(entry.target as HTMLElement);
        }
      },
      { rootMargin: "400px 0px" },
    );
    frames.forEach((f) => io.observe(f));
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [scope]);

  return null;
}
