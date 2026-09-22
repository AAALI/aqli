"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * `N` starts writing from the first-run screen (frame 04's keycap). Ignored
 * while typing in a field, and with any modifier held, so it never steals a
 * keystroke meant for something else.
 */
export default function WriteKey({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      router.push(href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);
  return null;
}
