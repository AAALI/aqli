import { Composio } from "@composio/core";
import type { IntegrationProvider } from "@/types/integration";

export const GITHUB_PR_TRIGGER = "GITHUB_PULL_REQUEST_EVENT";

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
