import { test as base, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Where global.setup.ts leaves the credentials it provisioned. */
export const ACCOUNT_FILE = path.join(__dirname, ".auth", "account.json");

export type Account = { id: string; email: string; password: string };

export function readAccount(): Account {
  if (!fs.existsSync(ACCOUNT_FILE)) throw new Error("No E2E account: did the setup project run?");
  return JSON.parse(fs.readFileSync(ACCOUNT_FILE, "utf8")) as Account;
}

/** Supabase admin REST, used only by setup/teardown. Needs the service key. */
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  return {
    async createUser(email: string, password: string) {
      const r = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST", headers,
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "E2E Writer" } }),
      });
      if (!r.ok) throw new Error(`createUser ${r.status}: ${await r.text()}`);
      return (await r.json()) as { id: string };
    },
    async deleteUser(id: string) {
      const r = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers });
      if (!r.ok && r.status !== 404) throw new Error(`deleteUser ${r.status}: ${await r.text()}`);
    },
    /** Deletes the workspaces the user administers; FKs cascade the rest. */
    async deleteWorkspacesOf(userId: string) {
      const list = await fetch(`${url}/rest/v1/members?select=workspace_id&user_id=eq.${userId}&role=eq.admin`, { headers });
      const rows = (await list.json()) as { workspace_id: string }[];
      for (const { workspace_id } of rows) {
        await fetch(`${url}/rest/v1/workspaces?id=eq.${workspace_id}`, { method: "DELETE", headers });
      }
    },
  };
}

/** Sign in through the real form via the password fallback. */
export async function signIn(page: Page, account: Account) {
  await page.goto("/login");
  // The first click can land before React has hydrated the form; retry until
  // the password field actually appears.
  await expect(async () => {
    await page.getByRole("button", { name: "Use password instead" }).click();
    await expect(page.getByLabel("Password")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export const test = base.extend<{ account: Account }>({
  // Playwright calls this callback `use`; named otherwise so the React hooks lint stays quiet.
  account: async ({}, provide) => { await provide(readAccount()); },
});

export { expect };
