import { Composio } from "@composio/core";
import type { IntegrationProvider } from "@/types/integration";

export const GITHUB_PR_TRIGGER = "GITHUB_PULL_REQUEST_EVENT";
export const GITHUB_LIST_REPOS_TOOL = "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER";

export type GithubRepo = { full_name: string; private: boolean };

/** Repos the connected GitHub account can access, most-recently-updated first. */
export async function listGithubRepos(composioUserId: string): Promise<GithubRepo[]> {
  const result = await executeComposioTool({
    composioUserId,
    toolkit: "github",
    tool: GITHUB_LIST_REPOS_TOOL,
    arguments: { per_page: 100, sort: "updated", type: "all" },
  });
  return parseRepoList(result);
}

function parseRepoList(result: unknown): GithubRepo[] {
  const data = unwrapRepoData(result);
  const arr = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.items)
      ? data.items
      : isRecord(data) && Array.isArray(data.repositories)
        ? data.repositories
        : [];

  const seen = new Set<string>();
  const repos: GithubRepo[] = [];
  for (const item of arr) {
    if (!isRecord(item)) continue;
    const fullName =
      stringField(item, "full_name") ??
      stringField(item, "fullName") ??
      stringField(item, "name");
    if (!fullName || seen.has(fullName)) continue;
    seen.add(fullName);
    repos.push({ full_name: fullName, private: item.private === true });
  }
  return repos;
}

function unwrapRepoData(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return value.data ?? value.result ?? value.response_data ?? value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const found = record[key];
  return typeof found === "string" && found.length > 0 ? found : null;
}

export function getComposioClient() {
  return new Composio({
    apiKey: process.env.COMPOSIO_API_KEY,
    allowTracking: false,
  });
}

export async function createConnectLink(input: {
  composioUserId: string;
  provider: IntegrationProvider;
  callbackUrl: string;
}) {
  const composio = getComposioClient();
  const session = await composio.create(input.composioUserId, {
    toolkits: { enable: [input.provider] },
  });
  const request = await session.authorize(input.provider, {
    callbackUrl: input.callbackUrl,
  });
  return request.redirectUrl;
}

export async function createGithubPullRequestTriggers(
  composioId: string,
  repos: { owner: string; repo: string }[],
) {
  if (repos.length === 0) return [];
  const composio = getComposioClient();
  await composio.triggers.getType(GITHUB_PR_TRIGGER).catch(() => null);

  const triggerIds: string[] = [];
  for (const repo of repos) {
    const trigger = await composio.triggers.create(
      composioId,
      GITHUB_PR_TRIGGER,
      { triggerConfig: { owner: repo.owner, repo: repo.repo } },
    );
    const id = readString(trigger, "triggerId") ?? readString(trigger, "trigger_id") ?? readString(trigger, "id");
    if (id) triggerIds.push(id);
  }
  return triggerIds;
}

export async function verifyComposioWebhook(input: {
  id: string;
  payload: string;
  signature: string;
  timestamp: string;
}) {
  const secret = process.env.COMPOSIO_WEBHOOK_SECRET;
  if (!secret) throw new Error("COMPOSIO_WEBHOOK_SECRET is not configured");
  return getComposioClient().triggers.verifyWebhook({
    ...input,
    secret,
  });
}

export async function executeComposioTool(input: {
  composioUserId: string;
  tool: string;
  toolkit: IntegrationProvider;
  arguments: Record<string, unknown>;
}) {
  const composio = getComposioClient();
  const session = await composio.create(input.composioUserId, {
    toolkits: { enable: [input.toolkit] },
  });
  return session.execute(input.tool, input.arguments);
}

function readString(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const found = (value as Record<string, unknown>)[key];
  return typeof found === "string" ? found : null;
}
