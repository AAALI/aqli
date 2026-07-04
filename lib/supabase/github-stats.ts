import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";

export type GitHubRepoStat = {
  full_name: string;
  events: number;
  docs_touched: number;
  last_event_at: string | null;
};

export type GitHubPolicyStats = {
  autoApprovedThisQuarter: number;
  docsTouchedThisQuarter: number;
  medianLatencyMs: number | null;
  repoStats: Map<string, GitHubRepoStat>;
};

type ActivityRow = {
  doc_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function quarterStart(now = new Date()): Date {
  const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(now.getUTCFullYear(), quarterMonth, 1));
}

/**
 * Stats for the GitHub settings policy page. Activity reads go through the
 * RLS-scoped client; the latency read uses the service client because
 * `integration_webhook_events` is a service-only table — it is filtered to
 * the given workspace and only reached from workspace-gated pages.
 */
export async function getGitHubPolicyStats(
  workspaceId: string,
): Promise<GitHubPolicyStats> {
  const supabase = await createServerSupabaseClient();
  const service = createServiceClient();

  const [{ data: activity }, { data: events }] = await Promise.all([
    supabase
      .from("doc_activity")
      .select("doc_id, created_at, metadata")
      .eq("workspace_id", workspaceId)
      .eq("actor_id", "composio-github")
      .order("created_at", { ascending: false })
      .limit(500),
    service
      .from("integration_webhook_events")
      .select("processed_at, pr_merged_at")
      .eq("provider", "github")
      .eq("workspace_id", workspaceId)
      .eq("status", "done")
      .not("pr_merged_at", "is", null)
      .not("processed_at", "is", null)
      .order("received_at", { ascending: false })
      .limit(200),
  ]);

  const qStart = quarterStart().toISOString();
  let autoApprovedThisQuarter = 0;
  const docsThisQuarter = new Set<string>();
  const repoStats = new Map<string, GitHubRepoStat>();

  for (const row of (activity ?? []) as ActivityRow[]) {
    const meta = row.metadata ?? {};
    if (meta.source !== "github_pr") continue;

    const repo = typeof meta.repo === "string" ? meta.repo : "unknown";
    const stat = repoStats.get(repo) ?? {
      full_name: repo,
      events: 0,
      docs_touched: 0,
      last_event_at: null,
    };
    stat.events += 1;
    // Rows arrive newest-first, so the first row per repo is its last event.
    stat.last_event_at ??= row.created_at;
    repoStats.set(repo, stat);

    if (row.created_at >= qStart) {
      docsThisQuarter.add(row.doc_id);
      if (meta.auto_approved === true) autoApprovedThisQuarter += 1;
    }
  }

  // Second pass for distinct docs per repo (cheap: same ≤500 rows).
  const docsPerRepo = new Map<string, Set<string>>();
  for (const row of (activity ?? []) as ActivityRow[]) {
    const meta = row.metadata ?? {};
    if (meta.source !== "github_pr") continue;
    const repo = typeof meta.repo === "string" ? meta.repo : "unknown";
    (docsPerRepo.get(repo) ?? docsPerRepo.set(repo, new Set()).get(repo)!).add(row.doc_id);
  }
  for (const [repo, docs] of docsPerRepo) {
    const stat = repoStats.get(repo);
    if (stat) stat.docs_touched = docs.size;
  }

  const latencies = ((events ?? []) as { processed_at: string; pr_merged_at: string }[])
    .map((e) => Date.parse(e.processed_at) - Date.parse(e.pr_merged_at))
    .filter((ms) => Number.isFinite(ms) && ms >= 0)
    .sort((a, b) => a - b);
  const medianLatencyMs = latencies.length
    ? latencies[Math.floor(latencies.length / 2)]
    : null;

  return {
    autoApprovedThisQuarter,
    docsTouchedThisQuarter: docsThisQuarter.size,
    medianLatencyMs,
    repoStats,
  };
}
