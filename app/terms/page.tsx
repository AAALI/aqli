import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalP, LegalList } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Aqli Cloud.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="11 July 2026"
      intro={
        <>
          These terms govern your use of <strong>Aqli Cloud</strong>, the hosted service at aqli.app. By creating
          an account you agree to them. The Aqli source code is separately available under the MIT license — if
          you self-host, the MIT license governs the code and these terms do not apply to your instance.
        </>
      }
    >
      <LegalSection title="The service">
        <LegalP>
          Aqli is a shared knowledge base for teams of humans and AI agents: humans write and review docs, agents
          read approved context and submit drafts through an API. Aqli Cloud is currently in{" "}
          <strong>beta</strong>: features may change, and while we work hard to keep the service available, we do
          not yet offer an uptime guarantee. You can export your docs as Markdown at any time.
        </LegalP>
      </LegalSection>

      <LegalSection title="Your account">
        <LegalList
          items={[
            "Provide accurate information and keep your credentials secure. You are responsible for activity under your account.",
            "Workspace admins control membership, roles, and API keys for their workspace.",
            "Agent API keys are secrets. Anything an agent writes with your workspace's key is your workspace's responsibility — that is what the review queue is for.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Your content">
        <LegalP>
          You own the content in your workspace. You grant us the limited rights needed to operate the service:
          storing your content, indexing it for search, processing it with the AI subprocessors listed in the{" "}
          Privacy Policy when you use AI features, and displaying it to the members of your workspace. We claim no
          other rights over it.
        </LegalP>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <LegalList
          items={[
            "No unlawful content or use.",
            "No attempts to breach, probe, or circumvent security or access controls — including other workspaces' data.",
            "No abusive load: don't flood the API or the AI endpoints beyond reasonable use; we may rate-limit or suspend accounts that endanger the service for others.",
            "No reselling the service without our written agreement.",
          ]}
        />
      </LegalSection>

      <LegalSection title="AI output">
        <LegalP>
          AI-generated content — summaries, answers, agent drafts — can be wrong. Aqli is built around human
          review precisely for this reason, but you are responsible for what your workspace approves and relies
          on. AI output is provided as-is.
        </LegalP>
      </LegalSection>

      <LegalSection title="Fees">
        <LegalP>
          Aqli Cloud is free while in beta. When paid plans are introduced, we will give existing workspaces
          advance notice and a fair migration path — nothing will be charged silently.
        </LegalP>
      </LegalSection>

      <LegalSection title="Termination">
        <LegalP>
          You can stop using the service and request deletion of your data at any time. We may suspend or
          terminate accounts that violate these terms; where reasonable, we will warn you first and give you the
          opportunity to export your data.
        </LegalP>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <LegalP>
          The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent
          permitted by law, our total liability for any claim arising out of the service is limited to the amount
          you paid us in the twelve months before the claim — which, during the free beta, is zero.
        </LegalP>
      </LegalSection>

      <LegalSection title="Governing law">
        <LegalP>These terms are governed by the laws of the United Arab Emirates.</LegalP>
      </LegalSection>

      <LegalSection title="Changes">
        <LegalP>
          We may update these terms as the product evolves. Material changes will be announced in the product with
          the updated date above. Questions? Email{" "}
          <a href="mailto:hello@aqli.app" style={{ color: "var(--accent)" }}>hello@aqli.app</a>.
        </LegalP>
      </LegalSection>
    </LegalPage>
  );
}
