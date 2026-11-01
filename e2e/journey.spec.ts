import { test, expect, signIn } from "./fixtures";

/**
 * The critical path, in order, sharing one browser and one workspace:
 * onboarding → write → publish → search → connect an agent → the agent's
 * write lands in the review queue → revoke the key. Each step is what a unit
 * test cannot see: the real database, RLS, PostgREST and the merge engine.
 */
test.describe.configure({ mode: "serial" });

let workspace: { slug: string; id: string };
let docId: string;
let apiKey: string;

test("a new account is taken through onboarding into a workspace", async ({ page, account }) => {
  await signIn(page, account);
  await expect(page).toHaveURL(/\/signup\?step=workspace/);
  await page.getByLabel("Workspace name").fill("E2E Workspace");
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("Anywhere else to put things?")).toBeVisible();
  await page.getByRole("button", { name: /Start writing|skip/ }).first().click();
  await page.waitForURL(/\/w\//);
  const slug = page.url().match(/\/w\/([^/?#]+)/)![1];
  const { workspaces } = await (await page.request.get("/api/workspaces")).json();
  workspace = { slug, id: workspaces.find((w: { slug: string }) => w.slug === slug).id };
});

test("writing autosaves and publishing makes the page current", async ({ page, account }) => {
  await signIn(page, account);
  await page.goto(`/w/${workspace.slug}/write`);
  await page.waitForURL(/\/docs\/[0-9a-f-]+\/edit/);
  docId = page.url().match(/\/docs\/([0-9a-f-]+)/)![1];

  await page.getByPlaceholder(/title|untitled/i).first().fill("Release checklist");
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.keyboard.type("Ship only after the zebrafish check passes.");
  await expect.poll(async () => (await (await page.request.get(`/api/docs/${docId}`)).json()).doc?.body_md ?? "", { timeout: 10_000 })
    .toContain("zebrafish");

  await page.getByRole("button", { name: /^Publish/ }).first().click();
  await page.getByRole("button", { name: /^Publish/ }).last().click();
  await expect.poll(async () => (await (await page.request.get(`/api/docs/${docId}`)).json()).doc?.status).toBe("approved");

  await page.goto(`/w/${workspace.slug}/docs/${docId}`);
  await expect(page.getByRole("heading", { name: "Release checklist" })).toBeVisible();
  await expect(page.getByText("Current")).toBeVisible();
});

test("search finds the page by a word that only appears in the body", async ({ page, account }) => {
  await signIn(page, account);
  const r = await page.request.get(`/api/search?q=zebrafish&workspace_id=${workspace.id}`);
  expect(r.status()).toBe(200);
  expect((await r.json()).results.map((h: { id: string }) => h.id)).toContain(docId);
  await page.goto(`/w/${workspace.slug}/search?q=zebrafish`);
  await expect(page.getByText("Release checklist").first()).toBeVisible();
});

test("an admin can mint an API key and an agent can read with it", async ({ page, account }) => {
  await signIn(page, account);
  const created = await page.request.post("/api/keys", { data: { workspace_id: workspace.id, name: "e2e-agent" } });
  expect(created.status()).toBe(201);
  const { key } = await created.json();
  expect(key.secret).toMatch(/^aqli_/);
  expect(key.key_hash).toBeUndefined();
  apiKey = key.secret;

  const headers = { Authorization: `Bearer ${apiKey}` };
  expect((await page.request.get("/api/agent/health", { headers })).status()).toBe(200);
  const docs = await (await page.request.get("/api/agent/docs", { headers })).json();
  expect(docs.docs.map((d: { id: string }) => d.id)).toContain(docId);
  expect((await page.request.get("/api/agent/docs", { headers: { Authorization: "Bearer aqli_nope" } })).status()).toBe(401);
});

test("an agent write waits in the review queue with the agent named", async ({ page, account }) => {
  await signIn(page, account);
  const r = await page.request.post("/api/agent/docs", {
    headers: { Authorization: `Bearer ${apiKey}` },
    data: { title: "Agent runbook", body_md: "# Runbook\n\nWritten by the e2e agent.", space: "company" },
  });
  expect(r.status()).toBe(202);
  await page.goto(`/w/${workspace.slug}/review`);
  await expect(page.getByText("Agent runbook")).toBeVisible();
  await expect(page.getByText(/e2e-agent wrote this/)).toBeVisible();
});

test("a revoked key stops working immediately", async ({ page, account }) => {
  await signIn(page, account);
  const { keys } = await (await page.request.get(`/api/keys?workspace_id=${workspace.id}`)).json();
  const id = keys.find((k: { name: string }) => k.name === "e2e-agent").id;
  expect((await page.request.delete(`/api/keys/${id}`)).status()).toBe(200);
  expect((await page.request.get("/api/agent/docs", { headers: { Authorization: `Bearer ${apiKey}` } })).status()).toBe(401);
});

test("inviting the same address twice re-sends rather than duplicating", async ({ page, account }) => {
  await signIn(page, account);
  const invite = () => page.request.post("/api/invitations", { data: { workspace_id: workspace.id, email: "Teammate@Example.com", role: "editor" } });
  const first = await (await invite()).json();
  const second = await (await invite()).json();
  expect(second.invitation.id).toBe(first.invitation.id);
  expect(second.invitation.token).not.toBe(first.invitation.token);
  const { invitations } = await (await page.request.get(`/api/invitations?workspace_id=${workspace.id}`)).json();
  expect(invitations.filter((i: { email: string }) => i.email === "teammate@example.com")).toHaveLength(1);
});

test("an unknown workspace is a 404, not an error page", async ({ page, account }) => {
  await signIn(page, account);
  // The status is 200 because the loading shell streams before notFound()
  // fires, so assert on what the person sees.
  await page.goto("/w/does-not-exist");
  await expect(page.getByText("This page could not be found")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Something went wrong");
});

test("a visitor is sent to login and the login page promises a link, not a code", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/w/anything");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("form")).not.toContainText(/code/i);
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
});
