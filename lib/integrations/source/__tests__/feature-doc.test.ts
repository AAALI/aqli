import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  processPullRequestData,
  processComposioWebhookPayload,
} from "../feature-doc";
import type { IntegrationConnection } from "@/types/integration";
import type { PullRequestSummary } from "../pr";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => ({ data: null, error: null })),
              })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: null })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/ai/embedder", () => ({
  embedDoc: vi.fn(),
}));

vi.mock("@/lib/supabase/activity", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/supabase/agent-docs", () => ({
  createAgentDoc: vi.fn(() => ({
    id: "doc-123",
    title: "Test PR",
    status: "approved",
  })),
  setAgentDocStatus: vi.fn(),
  updateAgentDoc: vi.fn((id, data) => ({
    id,
    ...data,
  })),
}));

vi.mock("@/lib/supabase/integration-webhook-events", () => ({
  claimPullRequestMerge: vi.fn(() => ({
    status: "claimed",
  })),
}));

vi.mock("@/lib/supabase/integration-connections", () => ({
  getServiceIntegrationByComposioUser: vi.fn(),
  updateIntegrationConnection: vi.fn(),
}));

vi.mock("../composio", () => ({
  executeComposioTool: vi.fn(),
  GITHUB_PR_TRIGGER: "github_pull_request_trigger",
}));

vi.mock("../ai", () => ({
  generateImplementedText: vi.fn(() => "Test implementation text"),
}));

describe("processComposioWebhookPayload", () => {
  it("ignores unsupported event types", async () => {
    const result = await processComposioWebhookPayload({
      type: "unsupported.event",
    });
    expect(result).toMatchObject({
      ignored: true,
      reason: "unsupported_event",
    });
  });

  it("ignores unsupported trigger slugs", async () => {
    const result = await processComposioWebhookPayload({
      type: "composio.trigger.message",
      metadata: { trigger_slug: "github_issue_trigger" },
    });
    expect(result).toMatchObject({
      ignored: true,
      reason: "unsupported_trigger",
    });
  });

  it("ignores payloads without user id", async () => {
    const result = await processComposioWebhookPayload({
      type: "composio.trigger.message",
      metadata: { trigger_slug: "github_pull_request_trigger" },
    });
    expect(result).toMatchObject({
      ignored: true,
      reason: "missing_user",
    });
  });
});

describe("processPullRequestData", () => {
  let mockConnection: IntegrationConnection;

  beforeEach(() => {
    mockConnection = {
      id: "conn-123",
      workspace_id: "ws-123",
      user_id: "user-456",
      provider: "github",
      status: "connected",
      composio_user_id: "user-123",
      connected_account_id: "acct-123",
      trigger_ids: ["trigger-123"],
      default_space_id: "space-123",
      metadata: {},
      last_event_at: null,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  it("ignores non-merge actions", async () => {
    const result = await processPullRequestData(
      mockConnection,
      {
        action: "opened",
        number: 42,
        title: "Test PR",
        url: "https://github.com/acme/web/pull/42",
        repository: { full_name: "acme/web" },
      },
      { enrich: false }
    );

    expect(result).toMatchObject({
      ignored: true,
      reason: "non_merge_action",
    });
  });

  it("ignores unmerged PRs in non-enrich mode", async () => {
    const result = await processPullRequestData(
      mockConnection,
      {
        action: "closed",
        merged: false,
        number: 42,
        title: "Test PR",
        url: "https://github.com/acme/web/pull/42",
        repository: { full_name: "acme/web" },
      },
      { enrich: false }
    );

    expect(result).toMatchObject({
      ignored: true,
      reason: "not_merged_pr",
    });
  });

  it("processes merged PRs and creates docs", async () => {
    const mockPr: PullRequestSummary = {
      owner: "acme",
      repo: "web",
      repoFullName: "acme/web",
      number: 42,
      title: "TAB-123 fix payout retry",
      body: "Adds retry guards",
      url: "https://github.com/acme/web/pull/42",
      merged: true,
      branch: "feature/tab-123-retry",
      baseBranch: "main",
      mergedAt: "2026-06-08T10:00:00Z",
    };

    const result = await processPullRequestData(
      mockConnection,
      {
        ...mockPr,
        action: "closed",
      },
      { enrich: false }
    );

    expect(result).toMatchObject({
      ignored: false,
      created: true,
      doc_id: "doc-123",
    });
  });

  it("handles duplicate PR merges via webhook event deduplication", async () => {
    const { claimPullRequestMerge } = await import("@/lib/supabase/integration-webhook-events");
    vi.mocked(claimPullRequestMerge).mockResolvedValueOnce({
      status: "already_processed",
      existing: { status: "processed", result: null },
    });

    const mockPr: PullRequestSummary = {
      owner: "acme",
      repo: "web",
      repoFullName: "acme/web",
      number: 42,
      title: "TAB-123 fix payout retry",
      body: "Adds retry guards",
      url: "https://github.com/acme/web/pull/42",
      merged: true,
      branch: "feature/tab-123-retry",
      baseBranch: "main",
      mergedAt: "2026-06-08T10:00:00Z",
    };

    const result = await processPullRequestData(
      mockConnection,
      {
        ...mockPr,
        action: "closed",
      },
      { enrich: false, webhookEventId: "event-123" }
    );

    expect(result).toMatchObject({
      ignored: true,
      reason: "duplicate_pr_merge",
    });
  });

  it("extracts Linear issue keys from PR metadata", async () => {
    const mockPr: PullRequestSummary = {
      owner: "acme",
      repo: "web",
      repoFullName: "acme/web",
      number: 42,
      title: "TAB-456 add metrics",
      body: "Closes TAB-456",
      url: "https://github.com/acme/web/pull/42",
      merged: true,
      branch: "feature/tab-456-metrics",
      baseBranch: "main",
      mergedAt: "2026-06-08T10:00:00Z",
    };

    const result = await processPullRequestData(
      mockConnection,
      {
        ...mockPr,
        action: "closed",
      },
      { enrich: false }
    );

    expect(result).toMatchObject({
      ignored: false,
      created: true,
    });
  });

  it("handles PRs without Linear issue keys", async () => {
    const mockPr: PullRequestSummary = {
      owner: "acme",
      repo: "web",
      repoFullName: "acme/web",
      number: 42,
      title: "Refactor retry helper",
      body: "No ticket for this cleanup.",
      url: "https://github.com/acme/web/pull/42",
      merged: true,
      branch: "refactor/retry-helper",
      baseBranch: "main",
      mergedAt: "2026-06-08T10:00:00Z",
    };

    const result = await processPullRequestData(
      mockConnection,
      {
        ...mockPr,
        action: "closed",
      },
      { enrich: false }
    );

    expect(result).toMatchObject({
      ignored: false,
      created: true,
    });
  });
});
