import Link from "next/link";
import { AuthStage, AuthField, authInputStyle } from "@/components/auth/AuthShell";
import { IconMail, IconCheck, IconX, IconArrowUpRight } from "@/components/aqli/icons";

const fieldInput: React.CSSProperties = { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--text-primary)", fontFamily: "inherit" };

export default function InvitePage() {
  return (
    <AuthStage
      ornament={
        <>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>You&apos;ve been invited</div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, width: "fit-content" }}>
            <span className="avatar avatar-ali" style={{ width: 44, height: 44, fontSize: 16 }}>A</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Ali Al-Mansoori</strong> invited you to
              </span>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>Tabadulat</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>tabadulat.aqli.app · 4 spaces · 38 docs</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Your role: <span style={{ color: "var(--accent)" }}>Editor</span>
            </div>
            <PermBullet text="Read and write docs in every Space" />
            <PermBullet text="Comment on, approve, or request changes to any doc" />
            <PermBullet text="Use the AI search and Ask features" />
            <PermBullet text="Cannot manage members or API keys (Admin only)" muted />
          </div>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em" }}>Join Tabadulat</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>Set a password to finish your account. Takes 10 seconds.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AuthField label="Full name">
            <span style={authInputStyle()}>
              <input defaultValue="Khalid Rashid" style={fieldInput} />
            </span>
          </AuthField>
          <AuthField label="Email">
            <span style={authInputStyle()}>
              <span style={{ color: "var(--text-muted)", display: "flex" }}><IconMail size={14} /></span>
              <input defaultValue="khalid@tabadulat.com" style={fieldInput} />
            </span>
          </AuthField>
          <AuthField label="Password" trailing={<span style={{ fontSize: 11, color: "var(--approved-text)", fontWeight: 500 }}>Strong</span>}>
            <span style={authInputStyle(true)}>
              <input type="password" defaultValue="aqli-demo-pass" style={fieldInput} />
            </span>
          </AuthField>
          <Link href="/login" className="btn btn-primary" style={{ width: "100%", height: 40, justifyContent: "center", marginTop: 6, gap: 6 }}>
            <span>Join Tabadulat</span>
            <IconArrowUpRight size={13} sw={1.8} />
          </Link>
        </div>

        <div style={{ padding: "10px 12px", background: "var(--bg-sidebar)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          By joining, you agree that the workspace admin can see your activity (docs you write, comments you leave). Your password is stored hashed; Aqli admins cannot see it.
        </div>
      </div>
    </AuthStage>
  );
}

function PermBullet({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: muted ? "var(--text-muted)" : "var(--text-primary)", opacity: muted ? 0.7 : 1 }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: muted ? "var(--bg-card)" : "var(--accent-light)", color: muted ? "var(--text-muted)" : "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${muted ? "var(--border)" : "rgba(15,110,86,0.2)"}` }}>
        {muted ? <IconX size={10} sw={2} /> : <IconCheck size={11} sw={2.4} />}
      </span>
      <span>{text}</span>
    </div>
  );
}
