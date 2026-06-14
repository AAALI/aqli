"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Notification } from "@/lib/supabase/notifications";
import {
  IconBell,
  IconRobot,
  IconCheck,
  IconClock,
  IconArrowUpRight,
} from "@/components/aqli/icons";

const TINTS: Record<Notification["tint"], { bg: string; color: string; border: string }> = {
  agent: { bg: "var(--agent-tint)", color: "var(--agent-icon)", border: "var(--agent-border)" },
  ok: { bg: "var(--approved-bg)", color: "var(--approved-text)", border: "var(--approved-border)" },
  review: { bg: "var(--review-bg)", color: "var(--review-text)", border: "var(--review-border)" },
  stale: { bg: "var(--stale-bg)", color: "var(--stale-text)", border: "var(--stale-border)" },
};

function tintIcon(n: Notification) {
  if (n.kind === "review") return <IconRobot size={14} />;
  if (n.kind === "approval") return <IconCheck size={14} />;
  if (n.kind === "stale") return <IconClock size={14} />;
  return <IconRobot size={14} />;
}

export default function NotificationsButton({ base }: { base: string }) {
  // base is the workspace path (e.g. "/w/acme"); pull the slug out robustly.
  const slug = base.match(/\/w\/([^/]+)/)?.[1] ?? "";
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load once, the first time the panel is opened.
  useEffect(() => {
    if (!open || notifs !== null) return;
    let cancelled = false;
    fetch(`/api/notifications?workspace=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setNotifs(d.notifications ?? []);
      })
      .catch(() => {
        if (!cancelled) setNotifs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, notifs, slug]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const hasUnread = (notifs ?? []).some((n) => n.unread);
  const today = (notifs ?? []).filter((n) => n.today);
  const earlier = (notifs ?? []).filter((n) => !n.today);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="iconbtn" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <IconBell size={17} />
        {hasUnread && <span className="dot" />}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 0,
            width: 400,
            maxHeight: 560,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 18px 48px -12px rgba(20,20,18,0.22), 0 2px 6px rgba(20,20,18,0.06)",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 18, letterSpacing: "-0.01em" }}>
              Notifications
            </h3>
            <button style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
              Mark all read
            </button>
          </div>

          <div style={{ overflow: "auto", flex: 1 }}>
            {notifs === null ? (
              <Empty text="Loading…" />
            ) : notifs.length === 0 ? (
              <Empty text="You're all caught up — nothing needs your attention." />
            ) : (
              <>
                {today.length > 0 && <Section label="Today" />}
                {today.map((n) => <Row key={n.id} n={n} base={base} onNav={() => setOpen(false)} />)}
                {earlier.length > 0 && <Section label="Earlier" />}
                {earlier.map((n) => <Row key={n.id} n={n} base={base} onNav={() => setOpen(false)} />)}
              </>
            )}
          </div>

          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 12 }}>
            <Link href={`${base}/review`} onClick={() => setOpen(false)} style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              See review queue <IconArrowUpRight size={11} sw={1.8} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div style={{ padding: "8px 16px 6px", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
      {label}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
      {text}
    </div>
  );
}

function Row({ n, base, onNav }: { n: Notification; base: string; onNav: () => void }) {
  const t = TINTS[n.tint];
  const inner = (
    <>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: t.bg, color: t.color, border: `1px solid ${t.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
        {tintIcon(n)}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.45 }}>
          <strong style={{ fontWeight: 500 }}>{n.actor}</strong>{" "}
          <span style={{ color: "var(--text-secondary)" }}>{n.body}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {n.target}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", gap: 6 }}>
          <span>{n.space}</span><span>·</span><span>{n.when}</span>
        </div>
      </div>
      {n.unread && <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--accent)", marginTop: 6 }} />}
    </>
  );
  const style: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "32px 1fr 8px",
    gap: 12,
    alignItems: "start",
    padding: "12px 16px",
    background: n.primary ? "var(--accent-light)" : "transparent",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    textDecoration: "none",
    color: "inherit",
  };
  return n.href ? (
    <Link href={`${base}/${n.href}`} style={style} onClick={onNav}>{inner}</Link>
  ) : (
    <div style={style}>{inner}</div>
  );
}
