"use client";

import { toggleMobileNav, useMobileNav } from "./mobile-nav";

/**
 * Opens the sidebar drawer on narrow viewports. Hidden by CSS above the
 * breakpoint, where the sidebar is always in flow.
 */
export default function MobileNavToggle() {
  const open = useMobileNav();
  return (
    <button
      type="button"
      className="tb-nav-toggle"
      aria-label={open ? "Close navigation" : "Open navigation"}
      aria-expanded={open}
      onClick={toggleMobileNav}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M2 4h12M2 8h12M2 12h12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
