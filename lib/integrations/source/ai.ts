import OpenAI from "openai";
import type { PullRequestFileSummary, PullRequestSummary } from "./pr";

type LinearIssueSummary = {
  key?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
};

export async function generateImplementedText(input: {
  pr: PullRequestSummary;
  files: PullRequestFileSummary[];
  linearIssue?: LinearIssueSummary | null;
  existingMarkdown?: string | null;
}) {
  if (!process.env.OPENAI_API_KEY) return fallbackImplementedText(input);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Write concise implementation notes for an internal engineering knowledge base. " +
            "Avoid hype. Use Markdown bullets when useful. " +
            "Return ONLY the body text for a 'What's implemented' section: no headings (no '#' title, no '## What's implemented'), " +
            "no preamble. If an existing doc excerpt is provided, return the full updated section body that supersedes it.",
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction: "Summarize what was implemented. Focus on durable knowledge future agents need. Do not mention that you are an AI.",
            pull_request: input.pr,
            linear_issue: input.linearIssue ?? null,
            changed_files: input.files.slice(0, 40),
            existing_doc_excerpt: input.existingMarkdown?.slice(0, 8000) ?? null,
          }),
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() || fallbackImplementedText(input);
  } catch (err) {
    // OpenAI request failed (timeout, rate limit, network, etc.). Fall back to
    // the deterministic implementation text so PR processing never aborts.
    console.warn("[ai.generateImplementedText] OpenAI call failed, using fallback:", err);
    return fallbackImplementedText(input);
  }
}

function fallbackImplementedText(input: {
  pr: PullRequestSummary;
  files: PullRequestFileSummary[];
  linearIssue?: LinearIssueSummary | null;
}) {
  const fileList = input.files.slice(0, 8).map((file) => `\`${file.filename}\``).join(", ");
  const linear = input.linearIssue?.key ? ` for ${input.linearIssue.key}` : "";
  return [
    `Merged PR #${input.pr.number}${linear}: ${input.pr.title}.`,
    input.pr.body ? input.pr.body.trim() : null,
    fileList ? `Primary files changed: ${fileList}.` : null,
  ].filter(Boolean).join("\n\n");
}
