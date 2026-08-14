"use client";

import { useState } from "react";
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
