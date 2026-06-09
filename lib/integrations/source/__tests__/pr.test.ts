import { describe, expect, it } from "vitest";
import {
  buildFixNoteMarkdown,
  extractLinearIssueKey,
  normalizePullRequestEvent,
  patchImplementedSection,
} from "../pr";

describe("extractLinearIssueKey", () => {
  it("extracts a Linear key from PR title, branch, or body", () => {
    expect(extractLinearIssueKey({
      title: "TAB-123 fix payout retry",
      body: "",
      branch: "feature/no-ticket",
    })).toBe("TAB-123");

    expect(extractLinearIssueKey({
      title: "Fix payout retry",
      body: "Closes https://linear.app/tabadulat/issue/TAB-456/payout-retry",
      branch: "feature/no-ticket",
    })).toBe("TAB-456");

    expect(extractLinearIssueKey({
      title: "Fix payout retry",
      body: "",
      branch: "ali/tab-789-payout-retry",
    })).toBe("TAB-789");
  });

  it("returns null when no issue key is present", () => {
    expect(extractLinearIssueKey({
      title: "Refactor retry helper",
      body: "No ticket for this cleanup.",
      branch: "refactor/retry-helper",
    })).toBeNull();
  });
});

describe("normalizePullRequestEvent", () => {
  it("normalizes common GitHub PR payload shapes and ignores unmerged PRs", () => {
    const merged = normalizePullRequestEvent({
      action: "closed",
      pull_request: {
        merged: true,
        number: 42,
        title: "TAB-123 fix payout retry",
        body: "Adds retry guards",
        html_url: "https://github.com/acme/web/pull/42",
        head: { ref: "feature/tab-123-retry" },
        base: { ref: "main" },
        merged_at: "2026-06-08T10:00:00Z",
      },
      repository: {
        full_name: "acme/web",
        owner: { login: "acme" },
        name: "web",
      },
    });

    expect(merged).toMatchObject({
      owner: "acme",
      repo: "web",
      repoFullName: "acme/web",
      number: 42,
      title: "TAB-123 fix payout retry",
      url: "https://github.com/acme/web/pull/42",
      merged: true,
      branch: "feature/tab-123-retry",
      baseBranch: "main",
    });

    expect(normalizePullRequestEvent({
      action: "closed",
      pull_request: { merged: false },
      repository: { full_name: "acme/web" },
    })).toBeNull();
  });
});

describe("patchImplementedSection", () => {
  it("replaces an existing What's implemented section without touching surrounding sections", () => {
    const result = patchImplementedSection(`# Title

## Problem
Old problem text.

## What's implemented
Old implementation text.

## Rollout
Keep rollout text.
`, "New implementation text.");

    expect(result).toContain("## Problem\nOld problem text.");
    expect(result).toContain("## What's implemented\nNew implementation text.");
    expect(result).toContain("## Rollout\nKeep rollout text.");
    expect(result).not.toContain("Old implementation text.");
  });

  it("adds What's implemented after the title when the section is missing", () => {
    const result = patchImplementedSection(`# Fix retry

## Context
The change has no Linear ticket.
`, "Created from a merged PR.");

    expect(result).toBe(`# Fix retry

## What's implemented
Created from a merged PR.

## Context
The change has no Linear ticket.
`);
  });

  it("strips echoed title/heading from the AI text so headings aren't duplicated", () => {
    const aiEcho = `# TAB-555 add metrics

## What's implemented
- Added metric payout.retry.idempotent_hit.`;
    const result = patchImplementedSection(`# TAB-555 add idempotency keys

## What's implemented
- Old note.
`, aiEcho);

    // Exactly one title and one section heading survive.
    expect(result.match(/^# /gm)?.length).toBe(1);
    expect(result.match(/## What's implemented/g)?.length).toBe(1);
    expect(result).toContain("- Added metric payout.retry.idempotent_hit.");
    expect(result).not.toContain("- Old note.");
  });
});

describe("buildFixNoteMarkdown", () => {
  it("creates a focused change doc from a merged PR without Linear context", () => {
    const markdown = buildFixNoteMarkdown({
      pr: {
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
      },
      files: [
        { filename: "lib/retry.ts", status: "modified", additions: 12, deletions: 3 },
      ],
      implementedText: "The retry helper now shares one timeout path.",
    });

    expect(markdown).toContain("# Refactor retry helper");
    expect(markdown).toContain("## What's implemented\nThe retry helper now shares one timeout path.");
    expect(markdown).toContain("## Source\n- PR: https://github.com/acme/web/pull/42");
    expect(markdown).toContain("- Repository: acme/web");
    expect(markdown).toContain("- `lib/retry.ts` modified (+12/-3)");
  });
});
