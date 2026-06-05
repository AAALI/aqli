"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@/components/ui/Dialog";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function NewSpaceButton({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📄");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, name, icon }),
      });
      if (res.ok) {
        setOpen(false);
        setName("");
        setIcon("📄");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
      >
        + New space
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New space">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-16 text-center"
              maxLength={2}
            />
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Space name"
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
