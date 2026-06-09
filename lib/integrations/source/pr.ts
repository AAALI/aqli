export type PullRequestSummary = {
  owner: string;
  repo: string;
  repoFullName: string;
  number: number;
  title: string;
  body: string;
  url: string;
  merged: boolean;
  branch: string;
  baseBranch: string;
  mergedAt: string | null;
};

export type PullRequestFileSummary = {
  filename: string;
  status?: string;
  additions?: number;
  deletions?: number;
};

type ExtractInput = {
  title?: string | null;
  body?: string | null;
  branch?: string | null;
};

const LINEAR_KEY_PATTERN = /\b([A-Z][A-Z0-9]+-\d+)\b/i;

export function extractLinearIssueKey(input: ExtractInput): string | null {
  const haystack = [input.title, input.body, input.branch].filter(Boolean).join("\n");
  const match = haystack.match(LINEAR_KEY_PATTERN);
  return match ? match[1].toUpperCase() : null;
}

export function normalizePullRequestEvent(data: unknown): PullRequestSummary | null {
  if (!isRecord(data)) return null;
  const pr = isRecord(data.pull_request) ? data.pull_request : data;
  const repository = isRecord(data.repository) ? data.repository : {};
  const merged = pr.merged === true || Boolean(pr.merged_at);
  if (!merged) return null;

  const repoFullName = stringValue(repository.full_name) ?? stringValue(data.repo) ?? "";
  const [fallbackOwner, fallbackRepo] = repoFullName.split("/");
  const owner = stringValue(recordValue(repository.owner)?.login) ?? stringValue(data.owner) ?? fallbackOwner;
  const repo = stringValue(repository.name) ?? stringValue(data.repository_name) ?? fallbackRepo;
  const number = numberValue(pr.number) ?? numberValue(data.number);
  const title = stringValue(pr.title) ?? stringValue(data.title);
  const url = stringValue(pr.html_url) ?? stringValue(pr.url) ?? stringValue(data.url);

  if (!owner || !repo || !number || !title || !url) return null;

  return {
    owner,
    repo,
    repoFullName: repoFullName || `${owner}/${repo}`,
    number,
    title,
    body: stringValue(pr.body) ?? "",
    url,
    merged: true,
    branch: stringValue(recordValue(pr.head)?.ref) ?? stringValue(data.branch) ?? "",
    baseBranch: stringValue(recordValue(pr.base)?.ref) ?? stringValue(data.base_branch) ?? "",
    mergedAt: stringValue(pr.merged_at) ?? stringValue(data.merged_at) ?? null,
  };
}

/**
 * The AI is asked for section *body* only, but models sometimes echo a title
 * (`# ...`) or repeat the `## What's implemented` heading — especially on the
 * update path where the existing doc is passed as context. Strip those so the
 * patched doc doesn't end up with nested/duplicated headings.
 */
export function sanitizeImplementedText(text: string): string {
  return text
    .replace(/^\s*#\s+.*$/gm, "") // drop H1 title lines
    .replace(/^\s*#{2,6}\s*what'?s\s+implemented\s*$/gim, "") // drop echoed section heading
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function patchImplementedSection(markdown: string, implementedText: string): string {
  const body = markdown.trimEnd();
  const replacement = `## What's implemented\n${sanitizeImplementedText(implementedText)}`;
  const headingPattern = /^## What's implemented\s*$/im;
  const match = headingPattern.exec(body);

  if (match) {
    const start = match.index;
    const afterHeading = start + match[0].length;
    const nextHeadingMatch = /^##\s+/im.exec(body.slice(afterHeading));
    const end = nextHeadingMatch ? afterHeading + nextHeadingMatch.index : body.length;
    return `${body.slice(0, start)}${replacement}\n\n${body.slice(end).replace(/^\n+/, "")}`.trimEnd() + "\n";
  }

  const titleMatch = /^# .+$/m.exec(body);
  if (!titleMatch) return `${replacement}\n\n${body}\n`;

  const insertAt = titleMatch.index + titleMatch[0].length;
  return `${body.slice(0, insertAt)}\n\n${replacement}\n\n${body.slice(insertAt).replace(/^\n+/, "")}`.trimEnd() + "\n";
}

export function buildFixNoteMarkdown({
  pr,
  files,
  implementedText,
  linearIssueKey,
}: {
  pr: PullRequestSummary;
  files: PullRequestFileSummary[];
  implementedText: string;
  linearIssueKey?: string | null;
}): string {
  const changedFiles = files.length
    ? files.map((file) => {
        const status = file.status ? ` ${file.status}` : "";
        const additions = file.additions ?? 0;
        const deletions = file.deletions ?? 0;
        return `- \`${file.filename}\`${status} (+${additions}/-${deletions})`;
      }).join("\n")
    : "- No file list was available from GitHub.";

  const linearLine = linearIssueKey ? `- Linear: ${linearIssueKey}\n` : "";

  return `# ${pr.title}

## What's implemented
${sanitizeImplementedText(implementedText)}

## Source
- PR: ${pr.url}
- Repository: ${pr.repoFullName}
- Branch: ${pr.branch || "unknown"} -> ${pr.baseBranch || "unknown"}
${linearLine}
## Changed files
${changedFiles}
`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
