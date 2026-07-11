import { createServiceClient } from "@/lib/supabase/server";
import { embedDoc } from "@/lib/ai/embedder";
import { logActivity } from "@/lib/supabase/activity";
import { createAgentDoc, setAgentDocStatus, updateAgentDoc } from "@/lib/supabase/agent-docs";
import { claimPullRequestMerge } from "@/lib/supabase/integration-webhook-events";
import { getServiceIntegrationByComposioUser, updateIntegrationConnection } from "@/lib/supabase/integration-connections";
import type { Doc, DocFrontmatter } from "@/types/doc";
import type { IntegrationConnection } from "@/types/integration";
import { executeComposioTool, GITHUB_PR_TRIGGER } from "./composio";
import { generateImplementedText } from "./ai";
import {
  buildFixNoteMarkdown,
  buildPullRequestMergeKey,
  extractLinearIssueKey,
  normalizeMarkdownForComparison,
  normalizePullRequestEvent,
  parsePullRequestCandidate,
  patchImplementedSection,
  stripAction,
  type PullRequestCandidate,
  type PullRequestFileSummary,
  type PullRequestSummary,
} from "./pr";

// PR lifecycle actions we treat as potential merges. Composio's slim payload
// fires for many actions; we ignore everything except the close path (which
// covers actual merges) so we don't act on `opened` / `synchronize` etc.
const MERGE_CANDIDATE_ACTIONS = new Set(["closed", "merged"]);

type WebhookPayload = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

/**
 * Composio's V3 webhook envelope isn't perfectly documented and field names
 * vary (snake_case vs camelCase, nesting under `data`). Pull the trigger slug,
 * the Composio user id, and the GitHub event payload from any of the known
 * shapes so a real event isn't silently dropped over a key-name mismatch.
 */
function extractTrigger(payload: WebhookPayload) {
  const metadata = asRecord(payload.metadata) ?? {};
  const data = asRecord(payload.data) ?? {};
  const dataMeta = asRecord(data.metadata) ?? {};

  const triggerSlug = firstString(
    metadata.trigger_slug, metadata.triggerSlug, metadata.triggerName,
    dataMeta.trigger_slug, dataMeta.triggerSlug,
    payload.triggerSlug, payload.trigger_slug,
  );
  const userId = firstString(
    metadata.user_id, metadata.userId, metadata.connectedAccountUserId,
    dataMeta.user_id, dataMeta.userId,
    payload.user_id, payload.userId,
  );
  // The GitHub event itself can be at payload.data, payload.data.payload, etc.
  const eventData =
    asRecord(data.payload) ?? (Object.keys(data).length ? data : asRecord(payload.payload)) ?? payload;

  return { triggerSlug, userId, eventData };
}

export async function processComposioWebhookPayload(
  payload: WebhookPayload,
  options: { webhookEventId?: string | null } = {},
) {
  const type = firstString(payload.type, payload.event, payload.eventType);
  const { triggerSlug, userId, eventData } = extractTrigger(payload);

  if (type && type !== "composio.trigger.message") {
    return { ignored: true, reason: "unsupported_event", type };
  }
  if (triggerSlug && triggerSlug !== GITHUB_PR_TRIGGER) {
    return { ignored: true, reason: "unsupported_trigger", triggerSlug };
  }
  if (!userId) {
    console.warn("[composio webhook] no user id found. payload keys:", Object.keys(payload));
    return { ignored: true, reason: "missing_user" };
  }

  const connection = await getServiceIntegrationByComposioUser(userId, "github");
  if (!connection) return { ignored: true, reason: "connection_not_found", userId };

  return processPullRequestData(connection, eventData, {
    enrich: true,
    webhookEventId: options.webhookEventId,
  });
}

/**
 * Workspace policy: merged PRs auto-approve by default (they were reviewed in
 * GitHub). Admins can turn this off on the GitHub settings page, routing
 * PR-sourced docs to the review queue instead.
 */
export function isAutoApproveEnabled(connection: IntegrationConnection): boolean {
  return connection.metadata?.auto_approve !== false;
}

export async function processPullRequestData(
  connection: IntegrationConnection,
  eventData: unknown,
  options: { enrich: boolean; webhookEventId?: string | null },
) {
  // Composio's slim webhook envelope omits `merged` / `merged_at`, so we
  // first parse a lenient candidate (action + identifiers) and decide what
  // to do based on `action` and any explicit merge signal in the payload.
  const candidate = parsePullRequestCandidate(eventData);
  if (!candidate) return { ignored: true, reason: "unparseable_pr" };

  if (candidate.action && !MERGE_CANDIDATE_ACTIONS.has(candidate.action)) {
    return { ignored: true, reason: "non_merge_action", action: candidate.action };
  }

  // Resolve a PR summary with a confirmed `merged: true`, enriching from the
  // GitHub REST API (via Composio) when the webhook payload alone can't tell
  // us. In non-enrich mode (used by /simulate where the caller supplies a
  // full GitHub-shaped payload), we trust the candidate's merge signal.
  let pr: PullRequestSummary;
  let files: PullRequestFileSummary[];
  if (options.enrich) {
    const resolved = await resolveMergedPullRequest(connection, candidate);
    if (!resolved) return { ignored: true, reason: "closed_without_merge" };
    pr = resolved.pr;
    files = resolved.files;
  } else {
    if (!candidate.merged) return { ignored: true, reason: "not_merged_pr" };
    pr = { ...stripAction(candidate), merged: true };
    files = [];
  }

  try {
    if (options.webhookEventId) {
      const mergeKey = buildPullRequestMergeKey(pr);
      const mergeClaim = await claimPullRequestMerge({
        eventId: options.webhookEventId,
        provider: "github",
        workspaceId: connection.workspace_id,
        prUrl: mergeKey.prUrl,
        mergedAt: mergeKey.mergedAt,
      });
      if (mergeClaim.status === "already_processed") {
        return {
          ignored: true,
          reason: "duplicate_pr_merge",
          existing: mergeClaim.existing,
          pr_url: mergeKey.prUrl,
          merged_at: mergeKey.mergedAt,
        };
      }
    }

    const linearIssueKey = extractLinearIssueKey({
      title: pr.title,
      body: pr.body,
      branch: pr.branch,
    });
    const linearIssue = linearIssueKey && options.enrich
      ? await fetchLinearIssue(connection, linearIssueKey)
      : linearIssueKey
        ? { key: linearIssueKey }
        : null;

    const match = await findMatchingDoc(connection.workspace_id, {
      linearIssueKey,
      prUrl: pr.url,
    });

    const implementedText = await generateImplementedText({
      pr,
      files,
      linearIssue,
      existingMarkdown: match?.body_md ?? null,
    });

    const autoApprove = isAutoApproveEnabled(connection);
    const result = match
      ? await updateMatchedDoc(match, pr, files, implementedText, linearIssueKey, autoApprove)
      : { doc: await createChangeDoc(connection, pr, files, implementedText, linearIssueKey, autoApprove), changed: true };

    await updateIntegrationConnection(connection.id, {
      last_event_at: new Date().toISOString(),
      last_error: null,
    });

    return { ignored: false, doc_id: result.doc.id, created: !match, changed: result.changed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown integration error";
    await updateIntegrationConnection(connection.id, {
      last_event_at: new Date().toISOString(),
      last_error: message,
    });
    throw err;
  }
}

/**
 * Resolve a candidate PR (typically from a slim Composio webhook) into a full
 * PR summary with confirmed `merged: true` plus the changed files. Returns
 * null when the PR is closed without merging, or when GitHub couldn't be
 * reached to verify the merge state (we'd rather drop a webhook than create
 * a spurious Fix Note for a closed-but-not-merged PR).
 */
async function resolveMergedPullRequest(
  connection: IntegrationConnection,
  candidate: PullRequestCandidate,
): Promise<{ pr: PullRequestSummary; files: PullRequestFileSummary[] } | null> {
  const [prDetails, filesResult] = await Promise.all([
    executeComposioTool({
      composioUserId: connection.composio_user_id,
      toolkit: "github",
      tool: "GITHUB_GET_A_PULL_REQUEST",
      arguments: { owner: candidate.owner, repo: candidate.repo, pull_number: candidate.number },
    }).catch((err) => {
      console.warn("[composio] GITHUB_GET_A_PULL_REQUEST failed", err);
      return null;
    }),
    executeComposioTool({
      composioUserId: connection.composio_user_id,
      toolkit: "github",
      tool: "GITHUB_LIST_PULL_REQUESTS_FILES",
      arguments: { owner: candidate.owner, repo: candidate.repo, pull_number: candidate.number },
    }).catch(() => null),
  ]);

  // Prefer the GitHub-confirmed PR object; fall back to the candidate only
  // if the candidate already carries an explicit merge signal.
  const enriched = normalizePullRequestEvent(readData(prDetails));
  if (!enriched) {
    if (!candidate.merged) return null;
    return {
      pr: { ...stripAction(candidate), merged: true },
      files: normalizeFiles(readData(filesResult)),
    };
  }

  return {
    pr: enriched,
    files: normalizeFiles(readData(filesResult)),
  };
}

async function fetchLinearIssue(connection: IntegrationConnection, issueKey: string) {
  const result = await executeComposioTool({
    composioUserId: connection.composio_user_id,
    toolkit: "linear",
    tool: "LINEAR_GET_LINEAR_ISSUE",
    arguments: { issue_id: issueKey, id: issueKey },
  }).catch(() => null);
  const data = readData(result);
  if (!data || typeof data !== "object") return { key: issueKey };
  const rec = data as Record<string, unknown>;
  return {
    key: issueKey,
    title: readString(rec.title),
    description: readString(rec.description),
    url: readString(rec.url),
  };
}

async function findMatchingDoc(
  workspaceId: string,
  input: { linearIssueKey: string | null; prUrl: string },
) {
  // Match in the DB instead of fetching N rows into memory: in larger
  // workspaces a capped (e.g. 500-most-recent) scan can miss an older
  // matching doc and produce a duplicate Fix Note for the same PR / Linear
  // issue. We run up to two targeted queries and take the most recent match.
  const supabase = createServiceClient();
  const selectCols = "*, space:spaces(id, workspace_id, name, slug, icon, created_at)";

  // The key is interpolated into a PostgREST .or() filter string below, so
  // only accept the strict Linear shape (ABC-123) — anything else could smuggle
  // filter syntax.
  if (input.linearIssueKey && /^[A-Z][A-Z0-9]*-\d+$/.test(input.linearIssueKey)) {
    const safeKey = input.linearIssueKey;
    const { data, error } = await supabase
      .from("docs")
      .select(selectCols)
      .eq("workspace_id", workspaceId)
      .or(
        `frontmatter->>linear_issue_id.eq.${safeKey},frontmatter->>linked_project_url.ilike.%${safeKey}%`,
      )
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data && data.length) return data[0] as Doc;
  }

  const { data, error } = await supabase
    .from("docs")
    .select(selectCols)
    .eq("workspace_id", workspaceId)
    .eq("frontmatter->>source_pr_url", input.prUrl)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data && data[0]) as Doc | undefined) ?? null;
}

async function updateMatchedDoc(
  doc: Doc,
  pr: PullRequestSummary,
  files: PullRequestFileSummary[],
  implementedText: string,
  linearIssueKey: string | null,
  autoApprove: boolean,
) {
  const bodyMd = patchImplementedSection(doc.body_md ?? `# ${doc.title}\n`, implementedText);
  const frontmatter: DocFrontmatter = {
    ...(doc.frontmatter ?? { tags: [] }),
    tags: doc.frontmatter?.tags ?? [],
    linear_issue_id: doc.frontmatter?.linear_issue_id ?? linearIssueKey ?? undefined,
    source_pr_url: pr.url,
    source_repo: pr.repoFullName,
  };
  const changed =
    normalizeMarkdownForComparison(doc.body_md) !== normalizeMarkdownForComparison(bodyMd) ||
    normalizeFrontmatterForComparison(doc.frontmatter) !== normalizeFrontmatterForComparison(frontmatter);

  if (!changed) {
    // Nothing to review — with auto-approve off, leave the doc exactly as it
    // is rather than flipping its status over a no-op merge.
    if (!autoApprove) return { doc, changed: false };
    const approved =
      doc.status === "approved"
        ? await touchReviewedAt(doc.id)
        : await setAgentDocStatus(doc.id, "approved", { markReviewed: true });
    return { doc: approved, changed: false };
  }

  const updated = await updateAgentDoc(doc.id, { body_md: bodyMd, frontmatter });
  // Merged PRs are already trusted — auto-approve so the doc is live context
  // immediately (unless the workspace turned the policy off, in which case the
  // patched doc goes to the review queue). Skip the status flip (and its
  // `status_change` snapshot) when the status is already right so we don't add
  // a no-op version entry.
  const targetStatus = autoApprove ? "approved" : "review";
  const resolved =
    updated.status === targetStatus
      ? autoApprove
        ? await touchReviewedAt(updated.id)
        : updated
      : await setAgentDocStatus(updated.id, targetStatus, { markReviewed: autoApprove });
  await embedDoc(resolved).catch((err) => console.error("Embed failed for integration doc", resolved.id, err));
  await logPrActivity(resolved, pr, files, false, autoApprove);
  return { doc: resolved, changed: true };
}

function normalizeFrontmatterForComparison(frontmatter: DocFrontmatter | null | undefined): string {
  return JSON.stringify(sortJson(frontmatter ?? { tags: [] }));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortJson(v)]),
  );
}

async function touchReviewedAt(id: string): Promise<Doc> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("docs")
    .update({ last_reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Doc;
}

async function createChangeDoc(
  connection: IntegrationConnection,
  pr: PullRequestSummary,
  files: PullRequestFileSummary[],
  implementedText: string,
  linearIssueKey: string | null,
  autoApprove: boolean,
) {
  const spaceId = await resolveDefaultSpaceId(connection);
  const bodyMd = buildFixNoteMarkdown({ pr, files, implementedText, linearIssueKey });
  // Merged PRs are already trusted, so create the doc directly as `approved`
  // (skipping the redundant `draft -> approved` status snapshot) — unless the
  // workspace disabled auto-approve, in which case it enters the review queue.
  const doc = await createAgentDoc({
    workspace_id: connection.workspace_id,
    space_id: spaceId,
    title: pr.title,
    type: "fix_note",
    body_md: bodyMd,
    agent_id: "composio-github",
    status: autoApprove ? "approved" : "review",
    markReviewed: autoApprove,
    frontmatter: {
      tags: ["github", "auto-update"],
      linear_issue_id: linearIssueKey ?? undefined,
      source_pr_url: pr.url,
      source_repo: pr.repoFullName,
    },
  });
  await embedDoc(doc).catch((err) => console.error("Embed failed for integration doc", doc.id, err));
  await logPrActivity(doc, pr, files, true, autoApprove);
  return doc;
}

async function resolveDefaultSpaceId(connection: IntegrationConnection) {
  if (connection.default_space_id) return connection.default_space_id;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, name")
    .eq("workspace_id", connection.workspace_id)
    .order("created_at", { ascending: true });
  const spaces = data ?? [];
  return spaces.find((space) => space.name === "Engineering")?.id ?? spaces[0]?.id ?? null;
}

async function logPrActivity(
  doc: Doc,
  pr: PullRequestSummary,
  files: PullRequestFileSummary[],
  created: boolean,
  autoApproved: boolean,
) {
  // One activity row per merge — the auto-approval is already implied by the
  // metadata (`auto_approved`) and the doc's status, so we don't emit a
  // separate `approved` entry that would double the feed.
  await logActivity({
    docId: doc.id,
    workspaceId: doc.workspace_id,
    actorType: "agent",
    actorId: "composio-github",
    actorName: "Composio GitHub",
    action: created ? "created" : "updated",
    metadata: {
      source: "github_pr",
      pr_url: pr.url,
      repo: pr.repoFullName,
      files_changed: files.length,
      auto_approved: autoApproved,
    },
  });
}

function normalizeFiles(value: unknown): PullRequestFileSummary[] {
  const data: unknown[] = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).files)
      ? (value as Record<string, unknown>).files as unknown[]
      : [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rec = item as Record<string, unknown>;
    const filename = readString(rec.filename) ?? readString(rec.file_name) ?? readString(rec.path);
    if (!filename) return [];
    return [{
      filename,
      status: readString(rec.status) ?? undefined,
      additions: readNumber(rec.additions),
      deletions: readNumber(rec.deletions),
    }];
  });
}

function readData(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const rec = value as Record<string, unknown>;
  return rec.data ?? rec.result ?? rec.response_data ?? value;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
