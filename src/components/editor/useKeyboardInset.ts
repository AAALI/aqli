"use client";

import { useEffect, useState } from "react";

/**
 * How far the bottom of the visual viewport sits above the bottom of the
 * layout viewport — the height of the on-screen keyboard, on browsers that
 * overlay it rather than resizing the page (Safari on iOS). Zero elsewhere,
 * and zero on a desktop, so a component can apply it unconditionally.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const measure = () => {
      const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // Under ~80px it is browser chrome moving, not a keyboard.
      setInset(next > 80 ? next : 0);
    };
    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, []);
  return inset;
}
