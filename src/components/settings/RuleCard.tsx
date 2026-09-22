"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One rule on a settings page (frames 10, 17): what it does in a sentence,
 * and a switch. The switch posts to whatever endpoint owns the setting and
 * refreshes, so the page never shows a state the server did not agree to.
 */
export default function RuleCard({
  title,
  body,
  aside,
  on,
  disabled,
  request,
}: {
  title: string;
  body: string;
  aside?: string;
  on: boolean;
  disabled?: boolean;
  /** Called with the new value; resolves when the server has it. */
  request: (next: boolean) => Promise<Response | null>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await request(!on).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const b = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(b?.error ?? "That didn't save. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 20px", marginTop: 12 }}>
      <div style={{ flex: 1 }}>
        <b style={{ fontSize: 14, fontWeight: 600 }}>{title}</b>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {body} {aside && <span style={{ color: "var(--text-muted)" }}>{aside}</span>}
        </p>
        {error && <p role="alert" style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--ageing-text)" }}>{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        className={`sw${on ? "" : " off"}`}
        onClick={toggle}
        disabled={busy || disabled}
      />
    </div>
  );
}
