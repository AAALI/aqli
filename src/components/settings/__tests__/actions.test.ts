import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import SettingsGeneralClient from "@/app/(app)/w/[workspace]/settings/SettingsGeneralClient";
import SettingsGeneralPage from "@/app/(app)/w/[workspace]/settings/page";
import IntegrationsPage from "@/app/(app)/w/[workspace]/settings/integrations/page";
import MembersClient from "@/app/(app)/w/[workspace]/settings/members/MembersClient";
import KeysClient from "@/app/(app)/w/[workspace]/settings/keys/KeysClient";
import ImportClient from "@/app/(app)/w/[workspace]/settings/import/ImportClient";
import GitHubRepoPicker from "@/components/integrations/GitHubRepoPicker";
import SettingsSidebar from "@/components/layout/SettingsSidebar";
import AccountMenu from "@/components/layout/AccountMenu";
import Onboarding from "@/components/auth/Onboarding";
import EmailAuthForm from "@/components/auth/EmailAuthForm";
import LoginPage from "@/app/(auth)/login/page";
import InviteClient from "@/app/(auth)/invite/InviteClient";
import { emailAuthError, emailCallbackUrl, safeAuthNext } from "@/lib/auth/email";
import { copyText } from "@/lib/clipboard";
import { workspaceForClient } from "@/lib/workspace-settings";

// Exercise the actual event handlers without a DOM dependency. State survives
// explicit rerenders; effects run only when a test starts a mount/load flow.
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  effects: [] as (() => void | (() => void))[],
}));
const mocks = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), replace: vi.fn(),
  signOut: vi.fn(), getUser: vi.fn(), getWorkspace: vi.fn(), getRole: vi.fn(),
  getConnections: vi.fn(), getSpaces: vi.fn(),
  sendOtp: vi.fn(), verifyOtp: vi.fn(), passwordLogin: vi.fn(), rpc: vi.fn(),
  assign: vi.fn(), search: "",
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: <T,>(initial: T | (() => T)) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [hooks.values[index], (value: T | ((previous: T) => T)) => {
      hooks.values[index] = typeof value === "function" ? (value as (previous: T) => T)(hooks.values[index] as T) : value;
    }];
  },
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  useMemo: <T,>(factory: () => T) => factory(),
  useCallback: <T,>(callback: T) => callback,
  useRef: <T,>(value: T) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = { current: value };
    return hooks.values[index];
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => string) => snapshot(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks,
  usePathname: () => "/w/team/settings",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: mocks.signOut, getUser: mocks.getUser, signInWithOtp: mocks.sendOtp,
      verifyOtp: mocks.verifyOtp, signInWithPassword: mocks.passwordLogin },
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/supabase/workspaces", () => ({ getWorkspaceBySlug: mocks.getWorkspace }));
vi.mock("@/lib/supabase/members", () => ({ getMyRole: mocks.getRole }));
vi.mock("@/lib/supabase/integration-connections", () => ({ listIntegrationConnections: mocks.getConnections }));
vi.mock("@/lib/supabase/spaces", () => ({ getSpaces: mocks.getSpaces }));
vi.mock("@/lib/supabase/github-stats", () => ({ getGitHubPolicyStats: async () => null }));
vi.mock("@/lib/analytics", () => ({
  capture: vi.fn(), captureException: vi.fn(), identify: vi.fn(),
}));

type Node = ReactElement<Record<string, unknown>>;
function nodes(value: ReactNode): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [value, ...nodes(value.props.children as ReactNode), ...nodes(value.props.action as ReactNode)];
}
function find(tree: ReactNode, match: (node: Node) => boolean): Node {
  const node = nodes(tree).find(match);
  if (!node) throw new Error("Control not found");
  return node;
}
function words(value: ReactNode): string {
  if (Array.isArray(value)) return value.map(words).join("");
  if (isValidElement<{ children?: ReactNode }>(value)) return words(value.props.children);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function control(tree: ReactNode, text: string): Node {
  return find(tree, (n) => n.type === "button" && words(n) === text);
}
async function trigger(node: Node, event = "onClick", value?: unknown) {
  await (node.props[event] as (value?: unknown) => unknown)(value);
}
function render<P>(component: (props: P) => ReactNode, props: P): ReactNode {
  hooks.index = 0;
  return component(props);
}
const submitEvent = { preventDefault() {} };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const workspace = { id: "workspace-id", name: "Team", slug: "team", settings: {}, created_at: "2026-01-01" };

beforeEach(() => {
  hooks.values = [];
  hooks.index = 0;
  hooks.effects = [];
  vi.clearAllMocks();
  mocks.search = "";
  vi.stubGlobal("window", { location: { origin: "https://aqli.example", assign: mocks.assign }, confirm: () => true });
  vi.stubGlobal("navigator", {});
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id", email: "writer@example.com" } } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("clipboard feedback", () => {
  it("reports unavailable and rejected clipboard writes as failures", async () => {
    expect(await copyText("test")).toBe(false);
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    expect(await copyText("test")).toBe(false);
  });

  it("waits for a successful write before reporting success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("test")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("test");
  });
});

describe("workspace settings", () => {
  it("does not serialize legacy provider keys, but preserves onboarding settings", () => {
    const original = { ...workspace, settings: { openai_key: "unused-test-key", onboarded_at: "done" } };
    expect(workspaceForClient(original).settings).toEqual({ onboarded_at: "done" });
    expect(original.settings.openai_key).toBe("unused-test-key");
  });

  it("passes only public identity and an AI-configured flag to the General client", async () => {
    mocks.getWorkspace.mockResolvedValue({ ...workspace, settings: { openai_key: "unused-test-key" } });
    mocks.getRole.mockResolvedValue("viewer");
    const page = await SettingsGeneralPage({ params: Promise.resolve({ workspace: "team" }) });
    const client = find(page, (n) => n.type === SettingsGeneralClient);
    expect(client.props.workspace).toEqual({ id: workspace.id, name: "Team", slug: "team" });
    expect(client.props.isAdmin).toBe(false);
    expect(JSON.stringify(client.props)).not.toContain("unused-test-key");
  });

  it("shows deployment instructions instead of a nonfunctional key input", async () => {
    const props = { workspace, isAdmin: true, aiConfigured: false };
    const tree = render(SettingsGeneralClient, props);
    expect(nodes(tree).some((n) => n.type === "input" && n.props.type === "password")).toBe(false);
    expect(words(tree)).toContain("OPENAI_API_KEY");
    const fetch = vi.fn().mockResolvedValue(response({ workspace }));
    vi.stubGlobal("fetch", fetch);
    await trigger(find(tree, (n) => n.type === "form"), "onSubmit", submitEvent);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: "Team", slug: "team" });
  });
});

describe("People actions", () => {
  const invitation = { id: "invite-id", email: "reader@example.com", role: "editor" as const, token: "test-token", created_at: "2026-10-30", expires_at: "2026-11-06", expiresInDays: 7 };
  const props = { workspaceId: workspace.id, appUrl: "", canManage: true, currentUserId: null, initialMembers: [], initialInvitations: [invitation] };

  it("offers a selectable invite link when copying is denied", async () => {
    await trigger(control(render(MembersClient, props), "Copy link"));
    const tree = render(MembersClient, props);
    expect(words(tree)).toContain("Couldn't copy the invite link");
    expect(find(tree, (n) => n.type === "input" && n.props.readOnly === true).props.value)
      .toBe("https://aqli.example/invite?token=test-token");
  });

  it("surfaces a failed withdraw request and re-enables the action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    await trigger(find(render(MembersClient, props), (n) => n.props["aria-label"] === "Withdraw the invite to reader@example.com"));
    const tree = render(MembersClient, props);
    expect(words(tree)).toContain("Couldn't reach the server");
    expect(find(tree, (n) => n.props["aria-label"] === "Withdraw the invite to reader@example.com").props.disabled).toBe(false);
  });
});

describe("API keys", () => {
  const key = { id: "key-id", name: "Agent", key_prefix: "test", last_used_at: null, created_at: "2026-01-01", scopes: ["read" as const] };
  const props = { workspaceId: workspace.id, appUrl: "", canManage: true, initialKeys: [key] };
  const keyRow = (tree: ReactNode) => find(tree, (n) => typeof n.props.onRevoke === "function");

  it("keeps a key listed and shows a server rejection when revoke fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "Admins only" }, 403)));
    await trigger(keyRow(render(KeysClient, props)), "onRevoke");
    const tree = render(KeysClient, props);
    expect(words(tree)).toContain("Admins only");
    expect(keyRow(tree).props.k).toEqual(key);
  });

  it("reports network errors and removes a key only after a successful revoke", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(response({ success: true }));
    vi.stubGlobal("fetch", fetch);
    await trigger(keyRow(render(KeysClient, props)), "onRevoke");
    expect(words(render(KeysClient, props))).toContain("Offline");
    await trigger(keyRow(render(KeysClient, props)), "onRevoke");
    expect(nodes(render(KeysClient, props)).some((n) => typeof n.props.onRevoke === "function")).toBe(false);
  });

  it("uses the browser origin when the deployment URL is unset", () => {
    expect(words(render(KeysClient, props))).toContain("https://aqli.example/api/mcp");
  });
});

describe("sign out", () => {
  it.each(["settings", "account"])("keeps the %s UI usable when Supabase refuses sign out", async (surface) => {
    mocks.signOut.mockResolvedValue({ error: new Error("Offline") });
    const draw = () => surface === "settings"
      ? render(SettingsSidebar, { base: "/w/team", workspaceName: "Team" })
      : render(AccountMenu, { base: "/w/team", workspaceSlug: "team", userName: "Writer" });
    if (surface === "account") await trigger(find(draw(), (n) => n.props["aria-label"] === "Account menu"));
    await trigger(control(draw(), "Sign out"));
    expect(words(draw())).toContain("Couldn't sign out");
    expect(control(draw(), "Sign out").props.disabled).toBe(false);
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("repository load safety", () => {
  it("cannot save an empty selection after a repository load failure", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ error: "GitHub unavailable" }, 502));
    vi.stubGlobal("fetch", fetch);
    const props = { workspaceId: workspace.id, spaces: [{ id: "space", name: "Company" }], defaultSpaceId: "space" };
    render(GitHubRepoPicker, props);
    hooks.effects[0]();
    await vi.waitFor(() => expect(control(render(GitHubRepoPicker, props), "Save repositories").props.disabled).toBe(true));
    await vi.waitFor(() => expect(words(render(GitHubRepoPicker, props))).toContain("GitHub unavailable"));
    await trigger(control(render(GitHubRepoPicker, props), "Save repositories"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("integration availability", () => {
  beforeEach(() => {
    mocks.getWorkspace.mockResolvedValue(workspace);
    mocks.getSpaces.mockResolvedValue([]);
  });

  it("does not offer an unavailable Linear connector as an available integration", async () => {
    mocks.getConnections.mockResolvedValue([]);
    const tree = await IntegrationsPage({ params: Promise.resolve({ workspace: "team" }) });
    expect(nodes(tree).some((n) => String(n.props.href ?? "").endsWith("/integrations/linear"))).toBe(false);
  });

  it("marks a legacy Linear connection unavailable, not active", async () => {
    mocks.getConnections.mockResolvedValue([{ provider: "linear", status: "connected" }]);
    const tree = await IntegrationsPage({ params: Promise.resolve({ workspace: "team" }) });
    const connection = find(tree, (n) => n.props.name === "Linear");
    expect(connection.props.unavailable).toBe(true);
    expect(words(connection.props.says as ReactNode)).toContain("not fetched");
  });
});

describe("import preview", () => {
  it("invalidates a dry run when the destination space changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ summary: { pages: 1, created: 1, updated: 0, failed: 0, dryRun: true } })));
    const props = { workspaceId: workspace.id, workspaceSlug: "team", base: "/w/team", spaces: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
    await trigger(find(render(ImportClient, props), (n) => n.props.type === "file"), "onChange", { target: { files: [new File(["test"], "test.zip")] } });
    await trigger(control(render(ImportClient, props), "Dry run"));
    expect(control(render(ImportClient, props), "Import").props.disabled).toBe(false);
    await trigger(find(render(ImportClient, props), (n) => n.type === "select"), "onChange", { target: { value: "b" } });
    expect(control(render(ImportClient, props), "Import").props.disabled).toBe(true);
    expect(words(render(ImportClient, props))).not.toContain("What this would do");
  });
});

describe("onboarding spaces", () => {
  it("offers a real retry after a selected space fails to create", async () => {
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/workspaces") return response({ workspaces: [workspace] });
      if (url === "/api/spaces" && init?.method === "POST") return response({}, fail ? 403 : 201);
      if (url.startsWith("/api/spaces?")) return response({ spaces: [{ name: "Company" }] });
      if (url.startsWith("/api/docs?")) return response({ docs: [] });
      return response({});
    }));
    render(Onboarding, {});
    hooks.effects.forEach((effect) => effect());
    await vi.waitFor(() => expect(words(render(Onboarding, {}))).toContain("Anywhere else"));
    await trigger(control(render(Onboarding, {}), "Engineering"));
    await trigger(find(render(Onboarding, {}), (n) => n.type === "form"), "onSubmit", submitEvent);
    await vi.waitFor(() => expect(words(render(Onboarding, {}))).toContain("Retry spaces"));
    fail = false;
    await trigger(control(render(Onboarding, {}), "Retry spaces"));
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/w/team/write"));
  });
});

describe("email auth", () => {
  const props = { next: "/invite?token=invite-token", shouldCreateUser: false, title: "Sign in.", eyebrow: "Welcome", description: "Use email.", allowPassword: true };
  const session = { data: { session: { access_token: "test-session" }, user: { id: "user-id", email: "writer@example.com" } }, error: null };
  const draw = (overrides = {}) => render(EmailAuthForm, { ...props, ...overrides });
  const emailInput = (tree: ReactNode) => find(tree, (n) => n.type === "input" && n.props.type === "email");
  const codeInput = (tree: ReactNode) => find(tree, (n) => n.props["aria-label"] === "Six-digit email code");
  const submit = (tree: ReactNode) => trigger(find(tree, (n) => n.type === "form"), "onSubmit", submitEvent);
  async function enterEmail(value = "writer@example.com") {
    await trigger(emailInput(draw()), "onChange", { target: { value } });
  }

  beforeEach(() => {
    mocks.sendOtp.mockResolvedValue({ error: null });
    mocks.verifyOtp.mockResolvedValue(session);
    mocks.passwordLogin.mockResolvedValue(session);
  });

  it("defaults to just email, with password available only after choosing it", async () => {
    expect(nodes(draw()).filter((n) => n.type === "input")).toHaveLength(1);
    expect(nodes(draw()).some((n) => n.props.type === "password")).toBe(false);
    await trigger(control(draw(), "Use password instead"));
    expect(find(draw(), (n) => n.props.type === "password")).toBeDefined();
  });

  it.each([false, true])("sends with shouldCreateUser=%s and a preserved callback destination", async (shouldCreateUser) => {
    await enterEmail(" Writer@Example.com ");
    await submit(draw({ shouldCreateUser }));
    const request = mocks.sendOtp.mock.calls[0][0];
    expect(request.email).toBe("writer@example.com");
    expect(request.options.shouldCreateUser).toBe(shouldCreateUser);
    const callback = new URL(request.options.emailRedirectTo);
    expect(callback.origin + callback.pathname).toBe("https://aqli.example/auth/callback");
    expect(callback.searchParams.get("next")).toBe(props.next);
    expect(codeInput(draw()).props.autoComplete).toBe("one-time-code");
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("verifies pasted digits through form submit (including Enter), then preserves next", async () => {
    await enterEmail();
    await submit(draw());
    // Native maxLength would truncate "123 456" before onChange sees it.
    expect(codeInput(draw()).props.maxLength).toBeUndefined();
    await trigger(codeInput(draw()), "onChange", { target: { value: "123 456" } });
    expect(codeInput(draw()).props.value).toBe("123456");
    await submit(draw());
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "writer@example.com", token: "123456", type: "email" });
    expect(mocks.assign).toHaveBeenCalledWith(props.next);
  });

  it.each(["send", "existing"])("focuses the code field after %s entry so Enter verifies instead of resending", async (entry) => {
    await enterEmail();
    if (entry === "send") await submit(draw());
    else await trigger(control(draw(), "I already have a code"));
    hooks.effects = [];
    const tree = draw();
    const focus = vi.fn();
    const inputRef = codeInput(tree).props.ref as { current: Pick<HTMLInputElement, "focus"> | null };
    inputRef.current = { focus };
    hooks.effects[0]();
    expect(focus).toHaveBeenCalledOnce();
    const sends = mocks.sendOtp.mock.calls.length;
    await trigger(codeInput(tree), "onChange", { target: { value: "123456" } });
    await submit(draw());
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "writer@example.com", token: "123456", type: "email" });
    expect(mocks.sendOtp).toHaveBeenCalledTimes(sends);
  });

  it("verifies an existing code in a fresh browser without sending or needing a verifier", async () => {
    await enterEmail();
    await trigger(control(draw(), "I already have a code"));
    await trigger(codeInput(draw()), "onChange", { target: { value: "654321" } });
    await submit(draw());
    expect(mocks.sendOtp).not.toHaveBeenCalled();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "writer@example.com", token: "654321", type: "email" });
    expect(mocks.assign).toHaveBeenCalledWith(props.next);
  });

  it("keeps the code field and permits retry after expired or invalid-code failures", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { code: "otp_expired" } });
    await enterEmail();
    await trigger(control(draw(), "I already have a code"));
    await trigger(codeInput(draw()), "onChange", { target: { value: "123456" } });
    await submit(draw());
    expect(codeInput(draw()).props.value).toBe("123456");
    expect(words(draw())).toContain("expired");
    expect(control(draw(), "Verify code").props.disabled).toBe(false);
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("does not submit an incomplete code", async () => {
    await enterEmail();
    await trigger(control(draw(), "I already have a code"));
    await trigger(codeInput(draw()), "onChange", { target: { value: "12" } });
    await submit(draw());
    expect(control(draw(), "Verify code").props.disabled).toBe(true);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("disables submit while verification is pending and ignores a duplicate submit", async () => {
    let finish!: (value: unknown) => void;
    mocks.verifyOtp.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await enterEmail();
    await trigger(control(draw(), "I already have a code"));
    await trigger(codeInput(draw()), "onChange", { target: { value: "123456" } });
    const verifying = submit(draw());
    expect(control(draw(), "Signing in…").props.disabled).toBe(true);
    await submit(draw());
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    finish(session);
    await verifying;
  });

  it("enforces a resend cooldown, then re-sends the same destination and clears old code", async () => {
    vi.useFakeTimers();
    await enterEmail();
    await submit(draw());
    expect(control(draw(), "Resend in 60s").props.disabled).toBe(true);
    await trigger(control(draw(), "Resend in 60s"));
    expect(mocks.sendOtp).toHaveBeenCalledTimes(1);
    for (let second = 0; second < 60; second++) {
      hooks.effects[hooks.effects.length - 1]();
      vi.advanceTimersByTime(1000);
      draw();
    }
    await trigger(codeInput(draw()), "onChange", { target: { value: "123456" } });
    await trigger(control(draw(), "Resend email"));
    expect(mocks.sendOtp).toHaveBeenCalledTimes(2);
    expect(mocks.sendOtp.mock.calls[1][0]).toEqual(mocks.sendOtp.mock.calls[0][0]);
    expect(codeInput(draw()).props.value).toBe("");
    expect(control(draw(), "Resend in 60s").props.disabled).toBe(true);
  });

  it("leaves email entry usable on send failure and explains an unknown login account", async () => {
    mocks.sendOtp.mockResolvedValue({ error: { code: "otp_disabled", message: "Signups not allowed for otp" } });
    await enterEmail();
    await submit(draw());
    expect(words(draw())).toContain("Create an account or use your workspace invitation");
    expect(emailInput(draw()).props.disabled).toBe(false);
    expect(control(draw(), "Email me a link and code").props.disabled).toBe(false);
  });

  it("shows network and rate-limit errors without claiming an email was sent", async () => {
    mocks.sendOtp.mockRejectedValueOnce(new TypeError("Network failure"));
    await enterEmail();
    await submit(draw());
    expect(words(draw())).toContain("Check your connection");
    mocks.sendOtp.mockResolvedValueOnce({ error: { status: 429 } });
    await submit(draw());
    expect(words(draw())).toContain("Too many attempts");
    expect(words(draw())).not.toContain("Email sent.");
    expect(control(draw(), "Email me a link and code").props.disabled).toBe(true);
  });

  it("returns to email entry without retaining the old code or errors", async () => {
    await enterEmail();
    await submit(draw());
    await trigger(codeInput(draw()), "onChange", { target: { value: "123456" } });
    await trigger(control(draw(), "Use a different email"));
    expect(emailInput(draw())).toBeDefined();
    expect(nodes(draw()).some((n) => n.props["aria-label"] === "Six-digit email code")).toBe(false);
    await trigger(control(draw(), "I already have a code"));
    expect(codeInput(draw()).props.value).toBe("");
  });

  it("keeps code entry available if resending fails", async () => {
    await enterEmail();
    await trigger(control(draw(), "I already have a code"));
    await trigger(codeInput(draw()), "onChange", { target: { value: "123456" } });
    mocks.sendOtp.mockRejectedValueOnce(new TypeError("Network failure"));
    await trigger(control(draw(), "Resend email"));
    expect(codeInput(draw()).props.value).toBe("123456");
    expect(words(draw())).toContain("Check your connection");
    expect(control(draw(), "Resend email").props.disabled).toBe(false);
  });

  it("does not navigate after verification returns no session", async () => {
    mocks.verifyOtp.mockResolvedValueOnce({ data: { session: null, user: null }, error: null });
    await enterEmail();
    await trigger(control(draw(), "I already have a code"));
    await trigger(codeInput(draw()), "onChange", { target: { value: "123456" } });
    await submit(draw());
    expect(mocks.assign).not.toHaveBeenCalled();
    expect(words(draw())).toContain("couldn't be verified");
  });

  it("preserves existing password sign-in without creating an account", async () => {
    await enterEmail();
    await trigger(control(draw(), "Use password instead"));
    await trigger(find(draw(), (n) => n.props.type === "password"), "onChange", { target: { value: "test-password" } });
    await submit(draw());
    expect(mocks.passwordLogin).toHaveBeenCalledWith({ email: "writer@example.com", password: "test-password" });
    expect(mocks.sendOtp).not.toHaveBeenCalled();
    expect(mocks.assign).toHaveBeenCalledWith(props.next);
  });
});

describe("passwordless auth destinations", () => {
  it.each(["https://other.example", "//other.example", "/\\other.example", "/\n/other.example"])("rejects unsafe next: %s", (next) => {
    expect(safeAuthNext(next)).toBe("/");
    expect(new URL(emailCallbackUrl("https://aqli.example", next)).searchParams.get("next")).toBe("/");
  });

  it("keeps login existing-account-only and carries next into the signup link", () => {
    mocks.search = "next=%2Finvite%3Ftoken%3Dinvite-token";
    const page = LoginPage();
    const form = find(page, (n) => typeof n.type === "function");
    const tree = render(form.type as () => ReactNode, {});
    const emailAuth = find(tree, (n) => n.type === EmailAuthForm);
    expect(emailAuth.props.shouldCreateUser).toBe(false);
    expect(emailAuth.props.allowPassword).toBe(true);
    expect(emailAuth.props.next).toBe("/invite?token=invite-token");
    const signup = find(emailAuth.props.footer as ReactNode, (n) => typeof n.props.href === "string");
    expect(new URL(String(signup.props.href), "https://aqli.example").searchParams.get("next")).toBe("/invite?token=invite-token");
  });

  it("offers passwordless signup with workspace onboarding as the default destination", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    render(Onboarding, {});
    hooks.effects.forEach((effect) => effect());
    await vi.waitFor(() => expect(nodes(render(Onboarding, {})).some((n) => n.type === EmailAuthForm)).toBe(true));
    const form = find(render(Onboarding, {}), (n) => n.type === EmailAuthForm);
    expect(form.props.shouldCreateUser).toBe(true);
    expect(form.props.allowPassword).toBeUndefined();
    expect(form.props.next).toBe("/signup?step=workspace");
  });

  it("preserves a signup next destination instead of replacing it with onboarding", async () => {
    mocks.search = "next=%2Finvite%3Ftoken%3Dinvite-token";
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    render(Onboarding, {});
    hooks.effects.forEach((effect) => effect());
    await vi.waitFor(() => expect(nodes(render(Onboarding, {})).some((n) => n.type === EmailAuthForm)).toBe(true));
    expect(find(render(Onboarding, {}), (n) => n.type === EmailAuthForm).props.next).toBe("/invite?token=invite-token");
  });

  it.each(["/signup?step=workspace", "/signup", "/signup/?step=workspace", "https://other.example"])(
    "resolves signed-in onboarding instead of staying on BootingScreen for next=%s",
    async (next) => {
      mocks.search = new URLSearchParams({ next }).toString();
      const fetch = vi.fn().mockResolvedValue(response({ workspaces: [] }));
      vi.stubGlobal("fetch", fetch);
      render(Onboarding, {});
      hooks.effects.forEach((effect) => effect());
      await vi.waitFor(() => expect(words(render(Onboarding, {}))).toContain("What should we call it?"));
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith("/api/workspaces");
    },
  );

  it("still redirects a signed-in user to an invitation on another route", async () => {
    mocks.search = new URLSearchParams({ next: "/invite?token=invite-token" }).toString();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(Onboarding, {});
    hooks.effects.forEach((effect) => effect());
    await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/invite?token=invite-token"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns invitation sign-in to the same invite and allows a new identity", async () => {
    mocks.search = "token=invite-token";
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.rpc.mockResolvedValue({ data: [{ status: "pending", expired: false, email: "reader@example.com", workspace_name: "Team", role: "editor" }], error: null });
    render(InviteClient, {});
    hooks.effects.forEach((effect) => effect());
    await vi.waitFor(() => expect(nodes(render(InviteClient, {})).some((n) => n.type === EmailAuthForm)).toBe(true));
    const form = find(render(InviteClient, {}), (n) => n.type === EmailAuthForm);
    expect(form.props.next).toBe("/invite?token=invite-token");
    expect(form.props.shouldCreateUser).toBe(true);
    expect(form.props.initialEmail).toBe("reader@example.com");
  });

  it("maps provider verification errors to user-facing guidance, not raw internals", () => {
    expect(emailAuthError({ message: "internal provider details" }, "verify")).toContain("couldn't be verified");
    expect(emailAuthError({ code: "over_email_send_rate_limit" }, "send")).toContain("Too many attempts");
  });
});
