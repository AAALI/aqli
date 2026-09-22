"use client";

import RuleCard from "@/components/settings/RuleCard";

/**
 * AI access · Rules (frame 10). Two switches that decide what "a person
 * confirms every agent draft" means in practice.
 */
export default function Rules({
  workspaceId,
  isAdmin,
  confirmAgentDrafts,
  openSpaceIds,
  reviewedSpaceIds,
  githubConnected,
  prSelfPublish,
  prAside,
}: {
  workspaceId: string;
  isAdmin: boolean;
  confirmAgentDrafts: boolean;
  /** Spaces that currently let agent writes merge unchecked. */
  openSpaceIds: string[];
  /** Spaces that currently hold agent writes for a person. */
  reviewedSpaceIds: string[];
  githubConnected: boolean;
  prSelfPublish: boolean;
  prAside?: string;
}) {
  return (
    <section className="sect">
      <div className="sect-h"><h2>Rules</h2></div>
      <RuleCard
        title="A person confirms every agent draft"
        body="Agent docs arrive in Checks as Unverified. Off means they publish themselves — with the agent named on the page."
        on={confirmAgentDrafts}
        disabled={!isAdmin}
        // Applied per space: on moves every open space to "review agents",
        // off moves those back to open. Spaces that review everything are
        // stricter than this rule and are left alone either way.
        request={async (next) => {
          const ids = next ? openSpaceIds : reviewedSpaceIds;
          const policy = next ? "review_agents" : "open";
          const results = await Promise.all(
            ids.map((id) =>
              fetch(`/api/spaces/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ review_policy: policy }),
              }),
            ),
          );
          return results.find((r) => !r.ok) ?? new Response(null, { status: 200 });
        }}
      />
      {githubConnected && (
        <RuleCard
          title="Docs from merged pull requests publish themselves"
          body="A human already reviewed the code. The doc is attributed to whoever merged it."
          aside={prAside}
          on={prSelfPublish}
          disabled={!isAdmin}
          request={(next) =>
            fetch("/api/integrations/composio/policy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workspace_id: workspaceId, auto_approve: next }),
            })
          }
        />
      )}
    </section>
  );
}
