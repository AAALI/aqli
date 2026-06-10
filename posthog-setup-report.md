<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Aqli codebase. PostHog is initialised client-side via `instrumentation-client.ts` (the recommended pattern for Next.js 15.3+), with a reverse proxy configured in `next.config.ts` routing `/ingest/*` through to the EU PostHog cluster. A server-side singleton client lives in `lib/posthog-server.ts`. User identification is performed at login and signup so that all subsequent events — both client and server — are linked to the same distinct ID. Exception capture is enabled on the client for automatic error tracking.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully created an account during onboarding | `components/auth/Onboarding.tsx` |
| `user_logged_in` | User successfully signed in to an existing account | `app/(auth)/login/page.tsx` |
| `workspace_created` | User created a new workspace during onboarding | `components/auth/Onboarding.tsx` |
| `doc_created` | User created a new doc from the new-doc picker, with the selected type | `app/(app)/w/[workspace]/(main)/s/[space]/new/NewDocClient.tsx` |
| `doc_status_changed` | User changed the status of a doc (draft → review → approved, etc.) | `components/docs/DocStatusControl.tsx` |
| `doc_reviewed` | Reviewer approved, rejected, or requested changes on an agent doc | `app/(app)/w/[workspace]/(main)/review/ReviewQueueClient.tsx` |
| `integration_connect_initiated` | Workspace admin initiated an OAuth integration connection | `app/api/integrations/composio/connect/route.ts` |
| `integration_connected` | Integration OAuth callback completed and connection was saved | `app/api/integrations/composio/callback/route.ts` |
| `webhook_doc_generated` | A Composio webhook triggered and completed a doc-generation pipeline | `app/api/integrations/composio/webhook/route.ts` |
| `ai_question_asked` | User submitted a question to the AI assistant and received an answer | `app/api/ai/ask/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/198158/dashboard/736380)
- [Signups & Logins](https://eu.posthog.com/project/198158/insights/0lujiD6o) — New signups and logins over time, top of the acquisition funnel
- [Onboarding funnel](https://eu.posthog.com/project/198158/insights/urXgWzn8) — Conversion from signup → workspace created → first doc created
- [Docs created by type](https://eu.posthog.com/project/198158/insights/RDbLyLTj) — Doc creation volume broken down by document type (PRD, ADR, runbook, etc.)
- [Review queue decisions](https://eu.posthog.com/project/198158/insights/XozbCTdz) — Agent doc reviews broken down by action (approve / reject / request changes)
- [AI assistant usage](https://eu.posthog.com/project/198158/insights/WiFKJmw3) — Trend of questions asked to the AI assistant

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
