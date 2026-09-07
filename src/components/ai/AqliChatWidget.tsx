"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import FloatingAssistant from "./FloatingAssistant";

/**
 * The workspace-wide Ask pill, mounted once in the workspace layout so it
 * floats on every page (home, spaces, search, settings) and the conversation
 * survives navigation.
 *
 * It stands down on the two doc surfaces. Those mount their own
 * `FloatingAssistant` — Co-write in the editor, a doc-scoped Ask in the viewer
 * — and the whole point of the redesign is that exactly one pill occupies the
 * bottom-right corner at a time. Without this guard the layout's pill and the
 * surface's pill both render, which is the bug being fixed.
 */
export default function AqliChatWidget({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Segment comparison rather than an interpolated regex: a slug is free text
  // and a "." in one would otherwise match any character.
  const segments = (pathname ?? "").replace(/\/+$/, "").split("/").filter(Boolean);
  const onDocSurface =
    segments[0] === "w" &&
    segments[1] === workspaceSlug &&
    segments[2] === "docs" &&
    Boolean(segments[3]) &&
    (segments.length === 4 || (segments.length === 5 && segments[4] === "edit"));
  if (onDocSurface) return null;

  return (
    <FloatingAssistant
      mode="ask"
      open={open}
      onToggle={setOpen}
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
    />
  );
}
