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
  patchImplementedSection,
  type PullRequestFileSummary,
  type PullRequestSummary,
} from "./pr";

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
  const pr = normalizePullRequestEvent(eventData);
  if (!pr) return { ignored: true, reason: "not_merged_pr" };

  try {
    const enriched = options.enrich ? await enrichPullRequest(connection, pr) : { pr, files: [] };
    const linearIssueKey = extractLinearIssueKey({
      title: enriched.pr.title,
      body: enriched.pr.body,
      branch: enriched.pr.branch,
    });
    const linearIssue = linearIssueKey && options.enrich
      ? await fetchLinearIssue(connection, linearIssueKey)
      : linearIssueKey
        ? { key: linearIssueKey }
        : null;

    const match = await findMatchingDoc(connection.workspace_id, {
      linearIssueKey,
      prUrl: enriched.pr.url,
    });

    const implementedText = await generateImplementedText({
      pr: enriched.pr,
      files: enriched.files,
      linearIssue,
      existingMarkdown: match?.body_md ?? null,
    });

    const doc = match
      ? await updateMatchedDoc(match, enriched.pr, enriched.files, implementedText, linearIssueKey)
      : await createChangeDoc(connection, enriched.pr, enriched.files, implementedText, linearIssueKey);

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

async function enrichPullRequest(connection: IntegrationConnection, pr: PullRequestSummary) {
  const [prDetails, filesResult] = await Promise.all([
    executeComposioTool({
      composioUserId: connection.composio_user_id,
      toolkit: "github",
      tool: "GITHUB_GET_A_PULL_REQUEST",
      arguments: { owner: pr.owner, repo: pr.repo, pull_number: pr.number },
    }).catch(() => null),
    executeComposioTool({
      composioUserId: connection.composio_user_id,
      toolkit: "github",
      tool: "GITHUB_LIST_PULL_REQUESTS_FILES",
      arguments: { owner: pr.owner, repo: pr.repo, pull_number: pr.number },
    }).catch(() => null),
  ]);

  return {
    pr: normalizePullRequestEvent(readData(prDetails) ?? pr) ?? pr,
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
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("docs")
    .select("*, space:spaces(id, workspace_id, name, slug, icon, created_at)")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const docs = (data ?? []) as Doc[];
  return docs.find((doc) => {
    const fm = doc.frontmatter ?? { tags: [] };
    if (input.linearIssueKey && fm.linear_issue_id?.toUpperCase() === input.linearIssueKey) return true;
    if (input.linearIssueKey && fm.linked_project_url?.toUpperCase().includes(input.linearIssueKey)) return true;
    return fm.source_pr_url === input.prUrl;
  }) ?? null;
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
  // immediately (and embedded as approved, so agents can retrieve it).
  const approved = await setAgentDocStatus(updated.id, "approved", { markReviewed: true });
  await embedDoc(approved).catch((err) => console.error("Embed failed for integration doc", approved.id, err));
  await logPrActivity(approved, pr, files, false);
  return approved;
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
  const doc = await createAgentDoc({
    workspace_id: connection.workspace_id,
    space_id: spaceId,
    title: pr.title,
    type: "fix_note",
    body_md: bodyMd,
    agent_id: "composio-github",
    frontmatter: {
      tags: ["github", "auto-update"],
      linear_issue_id: linearIssueKey ?? undefined,
      source_pr_url: pr.url,
      source_repo: pr.repoFullName,
    },
  });
  const approved = await setAgentDocStatus(doc.id, "approved", { markReviewed: true });
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
    },
  });
  // No review step: a merged PR is already trusted, so the doc is auto-approved.
  await logActivity({
    docId: doc.id,
    workspaceId: doc.workspace_id,
    actorType: "agent",
    actorId: "composio-github",
    actorName: "Composio GitHub",
    action: "approved",
    metadata: { auto_approved: true, reason: "merged_pr", to_status: "approved", pr_url: pr.url },
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
