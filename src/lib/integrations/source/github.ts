/**
 * GitHub, called directly.
 *
 * This replaces `@composio/core`, which cost 294 KiB gzipped inside a 3 MiB
 * Cloudflare Workers budget to provide OAuth, webhook plumbing, and four REST
 * calls. The four calls are below, as `fetch`.
 *
 * **No Octokit.** It is the obvious reach and it would undo the entire point of
 * the change — the whole surface this app needs is five endpoints and one HMAC.
 *
 * Everything here runs on Web Crypto and `fetch`, which the Workers runtime has
 * natively, so this module adds nothing to the bundle.
 */

const API = "https://api.github.com";

/** GitHub rejects requests without a User-Agent. */
const UA = "aqli";

export type GithubRepo = { full_name: string; private: boolean };

export class GithubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

async function ghRaw(
  token: string,
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API}${pathOrUrl}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      "User-Agent": UA,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    // The body carries GitHub's own message ("Bad credentials", "Not Found"),
    // which is the most useful thing to put in front of whoever pasted the
    // token. It cannot contain the token itself.
    const detail = await res.text().catch(() => "");
    let message = `GitHub returned ${res.status}`;
    try {
      const parsed = JSON.parse(detail) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      /* non-JSON error body; the status alone will have to do */
    }
    throw new GithubError(res.status, message);
  }

  return res;
}

async function gh<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await ghRaw(token, path, init);
  // 204 No Content has an empty body, and `res.json()` on it throws a
  // SyntaxError that no caller is expecting — DELETE returns 204.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Follow `Link: <...>; rel="next"` until the last page.
 *
 * GitHub caps `per_page` at 100 and says nothing when there is more; without
 * this, an account with 101 repos silently shows 100, and a PR touching 101
 * files silently reports 100. Capped at 10 pages so a pathological PR cannot
 * hold a request open indefinitely.
 */
async function ghPaged<T>(token: string, path: string, maxPages = 10): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;

  for (let page = 0; next && page < maxPages; page++) {
    const res: Response = await ghRaw(token, next);
    out.push(...((await res.json()) as T[]));
    next = nextLink(res.headers.get("link"));
  }
  return out;
}

/** The `rel="next"` URL from a Link header, if there is one. */
function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part.trim());
    if (match) return match[1];
  }
  return null;
}

/** Whether a token works, and who it belongs to. Used when one is pasted in. */
export async function verifyToken(token: string): Promise<{ login: string }> {
  const user = await gh<{ login: string }>(token, "/user");
  return { login: user.login };
}

/** Repos the token can reach, most recently updated first. Paginated. */
export async function listRepos(token: string): Promise<GithubRepo[]> {
  const repos = await ghPaged<{ full_name: string; private: boolean }>(
    token,
    "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
  );
  return repos.map((r) => ({ full_name: r.full_name, private: r.private }));
}

export async function getPullRequest(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<Record<string, unknown>> {
  return gh(token, `/repos/${owner}/${repo}/pulls/${number}`);
}

export async function listPullRequestFiles(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<Record<string, unknown>[]> {
  return ghPaged(token, `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`);
}

/**
 * Register a `pull_request` webhook on a repo.
 *
 * Replaces `composio.triggers.create`. Creating a hook needs admin on the repo;
 * a token without it gets a 404 from GitHub rather than a 403, which is why the
 * caller reports failures per repo instead of assuming the token is bad.
 */
export async function createPullRequestHook(
  token: string,
  input: { owner: string; repo: string; callbackUrl: string; secret: string },
): Promise<number> {
  const hook = await gh<{ id: number }>(
    token,
    `/repos/${input.owner}/${input.repo}/hooks`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["pull_request"],
        config: {
          url: input.callbackUrl,
          content_type: "json",
          secret: input.secret,
          insecure_ssl: "0",
        },
      }),
    },
  );
  return hook.id;
}

/**
 * Remove a repo hook.
 *
 * Reports which happened rather than collapsing both into success: the caller
 * only drops a hook id from the connection when it is `deleted` or `not_found`
 * — proof the hook is gone. A hook we merely failed to reach must keep its id,
 * or its deliveries stop resolving to a workspace and start 404ing.
 */
export async function deleteHook(
  token: string,
  owner: string,
  repo: string,
  hookId: number,
): Promise<"deleted" | "not_found"> {
  try {
    await gh(token, `/repos/${owner}/${repo}/hooks/${hookId}`, { method: "DELETE" });
    return "deleted";
  } catch (err) {
    if (err instanceof GithubError && err.status === 404) return "not_found";
    throw err;
  }
}

/** A secret for a new connection's hooks. 256 bits from the platform CSPRNG. */
export function newWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify GitHub's `X-Hub-Signature-256` header.
 *
 * HMAC-SHA256 of the **raw** request body under the secret we gave GitHub when
 * the hook was created, compared in constant time. This is the one piece of the
 * integration where a shortcut is a security hole rather than a bug, so, in
 * order:
 *
 *   - the body must be the exact bytes received. Re-serialising parsed JSON
 *     changes whitespace and key order and the digest with it, so the caller
 *     passes `await req.text()` and parses afterwards.
 *   - comparison is length-checked then XOR-accumulated over every byte, never
 *     `===`, which returns on the first differing byte and leaks the prefix
 *     length to anyone willing to time it.
 *   - a missing or malformed header is a failure, not a skip. "No signature"
 *     must never be the easy path through this function.
 */
export async function verifyWebhookSignature(input: {
  payload: string;
  signature: string | null;
  secret: string;
}): Promise<boolean> {
  const { payload, signature, secret } = input;
  if (!secret) return false;
  if (!signature || !signature.startsWith("sha256=")) return false;

  const provided = hexToBytes(signature.slice("sha256=".length));
  if (!provided) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );

  return timingSafeEqual(digest, provided);
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/*
 * There is deliberately no payload parser here. `parsePullRequestCandidate` in
 * ./pr.ts already reads GitHub's `pull_request` shape — it had to, since the
 * /simulate route feeds it real GitHub payloads — and a second parser would be
 * one more thing to keep in step with the first.
 */
