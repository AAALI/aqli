import { createServiceClient } from "@/lib/supabase/server";
import { embedDoc } from "@/lib/ai/embedder";
import { logActivity } from "@/lib/supabase/activity";
import { createAgentDoc, setAgentDocStatus, updateAgentDoc } from "@/lib/supabase/agent-docs";
import { getServiceIntegrationByComposioUser, updateIntegrationConnection } from "@/lib/supabase/integration-connections";
import type { Doc, DocFrontmatter } from "@/types/doc";
import type { IntegrationConnection } from "@/types/integration";
import { executeComposioTool, GITHUB_PR_TRIGGER } from "./composio";
import { generateImplementedText } from "./ai";
import {
  buildFixNoteMarkdown,
  extractLinearIssueKey,
  normalizePullRequestEvent,
  parsePullRequestCandidate,
  patchImplementedSection,
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

export async function processComposioWebhookPayload(payload: WebhookPayload) {
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

  return processPullRequestData(connection, eventData, { enrich: true });
}

export async function processPullRequestData(
  connection: IntegrationConnection,
  eventData: unknown,
  options: { enrich: boolean },
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
    const { action: _action, ...summary } = candidate;
    pr = { ...summary, merged: true };
    files = [];
  }

  try {
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

    const doc = match
      ? await updateMatchedDoc(match, pr, files, implementedText, linearIssueKey)
      : await createChangeDoc(connection, pr, files, implementedText, linearIssueKey);

    await updateIntegrationConnection(connection.id, {
      last_event_at: new Date().toISOString(),
      last_error: null,
    });

    return { ignored: false, doc_id: doc.id, created: !match };
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
    const { action: _action, ...summary } = candidate;
    return {
      pr: { ...summary, merged: true },
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

  if (input.linearIssueKey) {
    const key = input.linearIssueKey;
    // jsonb keys are stored as-is; match both exact `linear_issue_id` and any
    // `linked_project_url` containing the key (case-insensitive).
    const safeKey = key.replace(/[%,]/g, "");
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
) {
  const bodyMd = patchImplementedSection(doc.body_md ?? `# ${doc.title}\n`, implementedText);
  const frontmatter: DocFrontmatter = {
    ...(doc.frontmatter ?? { tags: [] }),
    tags: doc.frontmatter?.tags ?? [],
    linear_issue_id: doc.frontmatter?.linear_issue_id ?? linearIssueKey ?? undefined,
    source_pr_url: pr.url,
    source_repo: pr.repoFullName,
  };
  const updated = await updateAgentDoc(doc.id, { body_md: bodyMd, frontmatter });
  // Merged PRs are already trusted — auto-approve so the doc is live context
  // immediately. Skip the status flip (and its `status_change` snapshot) when
  // the doc is already approved so we don't add a no-op version entry.
  const approved =
    updated.status === "approved"
      ? await touchReviewedAt(updated.id)
      : await setAgentDocStatus(updated.id, "approved", { markReviewed: true });
  await embedDoc(approved).catch((err) => console.error("Embed failed for integration doc", approved.id, err));
  await logPrActivity(approved, pr, files, false);
  return approved;
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
) {
  const spaceId = await resolveDefaultSpaceId(connection);
  const bodyMd = buildFixNoteMarkdown({ pr, files, implementedText, linearIssueKey });
  // Merged PRs are already trusted, so create the doc directly as `approved`.
  // This skips the redundant `draft -> approved` status snapshot that used to
  // show up as a no-op v2 entry in the doc's version history.
  const approved = await createAgentDoc({
    workspace_id: connection.workspace_id,
    space_id: spaceId,
    title: pr.title,
    type: "fix_note",
    body_md: bodyMd,
    agent_id: "composio-github",
    status: "approved",
    markReviewed: true,
    frontmatter: {
      tags: ["github", "auto-update"],
      linear_issue_id: linearIssueKey ?? undefined,
      source_pr_url: pr.url,
      source_repo: pr.repoFullName,
    },
  });
  await embedDoc(approved).catch((err) => console.error("Embed failed for integration doc", approved.id, err));
  await logPrActivity(approved, pr, files, true);
  return approved;
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
) {
  // One activity row per merge — the auto-approval is already implied by the
  // metadata (`auto_approved: true`) and the doc's `approved` status, so we
  // don't emit a separate `approved` entry that would double the feed.
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
      auto_approved: true,
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
