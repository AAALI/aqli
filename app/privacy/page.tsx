import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalP, LegalList } from "@/components/landing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Aqli",
  description: "How Aqli Cloud collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="11 July 2026"
      intro={
        <>
          This policy describes how Aqli (&ldquo;we&rdquo;) handles your data when you use{" "}
          <strong>Aqli Cloud</strong>, the hosted service at aqli.app. If you self-host Aqli from the open source
          repository, your instance runs on your own infrastructure and this policy does not apply — you are the
          data controller there.
        </>
      }
    >
      <LegalSection title="What we collect">
        <LegalList
          items={[
            <>
              <strong>Account information</strong> — your email address, name, and password (stored hashed by our
              authentication provider).
            </>,
            <>
              <strong>Workspace content</strong> — the docs, comments, review decisions, activity logs, and
              settings your workspace creates, including content written by AI agents through your API keys.
            </>,
            <>
              <strong>Usage data</strong> — product analytics events (pages viewed, features used) and technical
              logs (requests, errors) that help us keep the service working and improve it.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="How we use it">
        <LegalList
          items={[
            "To provide the service: storing your docs, running search, powering the agent API, and syncing your connected integrations.",
            "To power AI features: when you use search answers, summaries, co-writing, or agent context queries, the relevant doc content is sent to our AI provider for processing (see subprocessors below). Per that provider's API terms, this content is not used to train their models.",
            "To understand product usage in aggregate and fix problems.",
          ]}
        />
        <LegalP>We do not sell your data, and we do not use your workspace content for advertising.</LegalP>
      </LegalSection>

      <LegalSection title="Subprocessors">
        <LegalP>Aqli Cloud runs on a small set of infrastructure providers:</LegalP>
        <LegalList
          items={[
            <><strong>Supabase</strong> — database, authentication, and vector storage (hosted in the EU, Frankfurt).</>,
            <><strong>Cloudflare</strong> — application hosting and content delivery.</>,
            <><strong>OpenAI</strong> — embeddings and AI text generation for the AI features described above.</>,
            <><strong>PostHog</strong> — product analytics (EU region).</>,
            <><strong>Composio</strong> — OAuth and webhook infrastructure for the GitHub and Linear integrations, only if your workspace connects them.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Cookies">
        <LegalP>
          We use essential cookies to keep you signed in (authentication session tokens) and analytics cookies to
          understand product usage. We do not use advertising cookies.
        </LegalP>
      </LegalSection>

      <LegalSection title="Security">
        <LegalP>
          Data is encrypted in transit and at rest. Access to workspace content is enforced at the database layer
          with row-level security, agent API keys are stored as one-way hashes, and every agent write is captured
          in an audit log your workspace can review.
        </LegalP>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <LegalP>
          We keep your data for as long as your account is active. Docs you delete are removed from the live
          database. To delete your account or an entire workspace, email us and we will remove the associated data
          within 30 days. You can export any doc as Markdown at any time.
        </LegalP>
      </LegalSection>

      <LegalSection title="Your rights">
        <LegalP>
          You can request access to, correction of, export of, or deletion of your personal data at any time by
          emailing <a href="mailto:hello@aqli.app" style={{ color: "var(--accent)" }}>hello@aqli.app</a>. If you
          are in a jurisdiction with data-protection laws (such as the GDPR), these rights are yours by law and we
          honour them regardless of where you are.
        </LegalP>
      </LegalSection>

      <LegalSection title="Changes">
        <LegalP>
          If we make material changes to this policy, we will update the date above and note the change in the
          product. Questions? Email{" "}
          <a href="mailto:hello@aqli.app" style={{ color: "var(--accent)" }}>hello@aqli.app</a>.
        </LegalP>
      </LegalSection>
    </LegalPage>
  );
}
