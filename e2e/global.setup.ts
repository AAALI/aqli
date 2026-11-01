import { test as setup } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ACCOUNT_FILE, admin } from "./fixtures";

setup("provision a test account", async () => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = `E2e-${Math.random().toString(36).slice(2)}-Pass1!`;
  const { id } = await admin().createUser(email, password);
  fs.mkdirSync(path.dirname(ACCOUNT_FILE), { recursive: true });
  fs.writeFileSync(ACCOUNT_FILE, JSON.stringify({ id, email, password }));
});
