import { test as teardown } from "@playwright/test";
import fs from "node:fs";
import { ACCOUNT_FILE, admin, readAccount } from "./fixtures";

teardown("remove the test account and its workspaces", async () => {
  if (!fs.existsSync(ACCOUNT_FILE)) return;
  const { id } = readAccount();
  const api = admin();
  await api.deleteWorkspacesOf(id);
  await api.deleteUser(id);
  fs.rmSync(ACCOUNT_FILE);
});
