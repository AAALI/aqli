"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  IconChevDown,
  IconGear,
  IconLogOut,
} from "@/components/aqli/icons";
import { avatarColor } from "@/lib/utils";

type Props = {
  base: string;
  userName: string;
  workspaceSlug: string;
  roleLabel?: string;
};

export default function AccountMenu({
  base,
  userName,
  workspaceSlug,
  roleLabel = `aqli.app/${workspaceSlug}`,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = userName.trim().charAt(0).toUpperCase() || "Y";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="sb-foot" style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-sans)",
        }}
        aria-label="Account menu"
      >
        <span className="avatar" style={{ background: avatarColor(userName) }}>{initial}</span>
        <span className="meta">
          <span className="n">{userName}</span>
          <span className="w">{roleLabel}</span>
        </span>
        <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>
          <IconChevDown size={13} />
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 48,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow:
              "0 18px 48px -12px rgba(20,20,18,0.22), 0 2px 6px rgba(20,20,18,0.06)",
            padding: 6,
            zIndex: 70,
          }}
        >
          <Link
            href={`${base}/settings`}
            onClick={() => setOpen(false)}
            className="account-menu-item"
          >
            <IconGear size={14} />
            Settings
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="account-menu-item"
            style={{ width: "100%" }}
          >
            <IconLogOut size={14} />
            {busy ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
