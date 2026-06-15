"use client";

import { IconSearch } from "@/components/aqli/icons";

/** Top-bar entry point for the ⌘K command palette. */
export default function CmdKButton() {
  return (
    <button
      type="button"
      className="iconbtn"
      title="Search — ⌘K"
      aria-label="Search"
      onClick={() => window.dispatchEvent(new CustomEvent("aqli:open-cmdk"))}
    >
      <IconSearch size={16} />
    </button>
  );
}
