"use client";

import { useEffect, useState } from "react";
import FloatingAssistant from "@/components/ai/FloatingAssistant";

/**
 * The viewer's floating pill, scoped to the doc being read.
 *
 * Exists only to own the open/closed state: the doc page is a Server
 * Component and `FloatingAssistant` is controlled.
 */
export default function DocAskAssistant({
  workspaceId,
  workspaceSlug,
  docId,
  docTitle,
}: {
  workspaceId: string;
  workspaceSlug: string;
  docId: string;
  docTitle: string;
}) {
  const [open, setOpen] = useState(false);
  // The phone's read bar has no dot to tap; it asks by event instead.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("aqli:open-ask", onOpen);
    return () => window.removeEventListener("aqli:open-ask", onOpen);
  }, []);
  return (
    <FloatingAssistant
      mode="ask"
      open={open}
      onToggle={setOpen}
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
      docId={docId}
      docTitle={docTitle}
    />
  );
}
