export type LinearPreview = {
  id: string;
  title: string;
  status: string;
  url: string;
  type: "issue" | "project";
};

/**
 * Detect a Linear URL and extract its type + id. Supports:
 *   https://linear.app/{team}/issue/{id}
 *   https://linear.app/{team}/project/{id}
 */
export function parseLinearUrl(url: string): { type: "issue" | "project"; id: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("linear.app")) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 3) return null;
    const type = parts[1] === "project" ? "project" : "issue";
    return { type, id: parts[2] };
  } catch {
    return null;
  }
}

/**
 * Fetch an issue/project preview from Linear. Returns null gracefully when
 * LINEAR_API_KEY is unset or the request fails — the linked field still works.
 */
export async function fetchLinearPreview(url: string): Promise<LinearPreview | null> {
  const parsed = parseLinearUrl(url);
  if (!parsed) return null;

  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) return null;

  const gql =
    parsed.type === "issue"
      ? `{ issue(id: "${parsed.id}") { id title url state { name } } }`
      : `{ project(id: "${parsed.id}") { id name url state } }`;

  try {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ query: gql }),
    });
    const data = await response.json();

    if (parsed.type === "issue") {
      const issue = data?.data?.issue;
      if (!issue) return null;
      return { id: issue.id, title: issue.title, status: issue.state?.name ?? "Unknown", url: issue.url, type: "issue" };
    }
    const project = data?.data?.project;
    if (!project) return null;
    return { id: project.id, title: project.name, status: project.state ?? "Unknown", url: project.url, type: "project" };
  } catch {
    return null;
  }
}
