// Shared shell for the legal pages (/privacy, /terms). Server-rendered,
// deliberately plain: a slim nav back to the landing page, a typographic
// content column, and a minimal footer.

import Link from "next/link";
import type { ReactNode } from "react";

import { AqliMark } from "@/components/aqli/AqliMark";

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2
        style={{
          margin: "18px 0 0",
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: 24,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>{children}</p>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header style={{ borderBottom: "1px solid var(--border)", background: "rgba(250,250,248,0.85)" }}>
        <div
          style={{
            height: 60,
            maxWidth: 1440,
            margin: "0 auto",
            padding: "0 clamp(20px, 5vw, 56px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text-primary)" }}>
            <AqliMark size={20} />
            <span style={{ fontSize: 16, letterSpacing: "0.08em", fontWeight: 500 }}>aqli</span>
          </Link>
          <Link href="/login" style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500 }}>
            Sign in
          </Link>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <article
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "clamp(48px, 8vw, 80px) clamp(20px, 5vw, 56px) 96px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: "clamp(32px, 6vw, 44px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h1>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Last updated: {updated}</div>
          <LegalP>{intro}</LegalP>
          {children}
        </article>
      </main>

      <footer style={{ borderTop: "1px solid var(--border)" }}>
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "20px clamp(20px, 5vw, 56px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            fontSize: 11.5,
            color: "var(--text-muted)",
          }}
        >
          <span>© 2026 Aqli · Open source under MIT</span>
          <span style={{ display: "flex", gap: 16 }}>
            <Link href="/privacy" style={{ color: "var(--text-muted)" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "var(--text-muted)" }}>Terms</Link>
            <a href="mailto:hello@aqli.app" style={{ color: "var(--text-muted)" }}>Contact</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
