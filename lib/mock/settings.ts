// Mock data for Week-2 settings surfaces (API keys, members, integrations,
// agent activity). No backend yet — representative sample data.

export type ApiKey = {
  name: string;
  preview: string;
  created: string;
  createdBy: string;
  scope: { kind: "read" | "write" | "review"; label: string };
  lastUsed: string;
  usage: string;
};

export const SAMPLE_KEYS: ApiKey[] = [
  {
    name: "Claude Code · Ali's laptop",
    preview: "aqli_live_••••3f2a",
    created: "Jun 1",
    createdBy: "Ali",
    scope: { kind: "write", label: "Read + write" },
    lastUsed: "2 minutes ago",
    usage: "142 reads · 8 writes this week",
  },
  {
    name: "Cursor · Sara's workstation",
    preview: "aqli_live_••••91c4",
    created: "Apr 18",
    createdBy: "Sara",
    scope: { kind: "write", label: "Read + write" },
    lastUsed: "1 hour ago",
    usage: "86 reads · 3 writes this week",
  },
  {
    name: "GPT-4o Batch Worker",
    preview: "aqli_live_••••a07b",
    created: "Mar 22",
    createdBy: "Khalid",
    scope: { kind: "read", label: "Read only" },
    lastUsed: "Never",
    usage: "Connected to Compliance space",
  },
];

export type Member = {
  name: string;
  email: string;
  initial: string;
  cls: string;
  role: string;
  status: "active" | "pending";
  joined: string;
};

export const MEMBERS: Member[] = [
  { name: "Ali Al-Mansoori", email: "ali@acme.com", initial: "A", cls: "avatar-ali", role: "Admin", status: "active", joined: "Owner · Jan 2024" },
  { name: "Sara Haddad", email: "sara@acme.com", initial: "S", cls: "avatar-sara", role: "Admin", status: "active", joined: "Joined Feb 2024" },
  { name: "Khalid Nasser", email: "khalid@acme.com", initial: "K", cls: "avatar-khalid", role: "Editor", status: "active", joined: "Joined Mar 2024" },
  { name: "Layla Mansour", email: "layla@acme.com", initial: "L", cls: "avatar-sara", role: "Editor", status: "pending", joined: "Invited 2 days ago" },
];

export type AgentEvent = {
  agent: string;
  action: string;
  target: string;
  space: string;
  result: "approved" | "pending" | "rejected" | "read";
  when: string;
};

export const AGENT_ACTIVITY: AgentEvent[] = [
  { agent: "Claude Code", action: "wrote", target: "Fix: Payout retry on transient bank failures", space: "Engineering", result: "pending", when: "1 hour ago" },
  { agent: "Claude Code", action: "read", target: "Bank API Runbook §3", space: "Engineering", result: "read", when: "1 hour ago" },
  { agent: "Cursor Agent", action: "wrote", target: "Sticky-host routing for reservations", space: "Engineering", result: "pending", when: "3 hours ago" },
  { agent: "Claude Code", action: "wrote", target: "Fix: Identity Verification Status Sync", space: "Engineering", result: "approved", when: "Yesterday" },
  { agent: "GPT-4o Batch Worker", action: "read", target: "T&S Hold Rule 4.2", space: "Compliance", result: "read", when: "Yesterday" },
  { agent: "Cursor Agent", action: "wrote", target: "Cache invalidation proposal", space: "Engineering", result: "rejected", when: "2 days ago" },
];

export type Integration = {
  id: string;
  name: string;
  desc: string;
  connected: boolean;
  detail?: string;
};

export const INTEGRATIONS: Integration[] = [
  { id: "linear", name: "Linear", desc: "Link docs to issues. Agents read issue context before writing.", connected: true, detail: "Connected to ACME · 3 projects" },
  { id: "slack", name: "Slack", desc: "Route review requests and approvals to channels.", connected: true, detail: "Connected to acme.slack.com · 2 channels" },
  { id: "github", name: "GitHub", desc: "Mirror approved docs to a repo as Markdown.", connected: false },
  { id: "mcp", name: "MCP Server", desc: "Expose docs to any MCP-compatible client.", connected: false },
];

export type StaleDoc = {
  id: string;
  title: string;
  type: string;
  space: string;
  owner: { name: string; initial: string; cls: string };
  age: string;
  risk: "high" | "medium" | "low";
  reason: string;
};

export const STALE_DOCS: StaleDoc[] = [
  { id: "s1", title: "Search Ranking Service Runbook", type: "Runbook", space: "Engineering", owner: { name: "Sara", initial: "S", cls: "avatar-sara" }, age: "142 days", risk: "high", reason: "On-call runbook · referenced 38× this quarter" },
  { id: "s2", title: "Payment Provider Failover Policy", type: "Policy", space: "Compliance", owner: { name: "Khalid", initial: "K", cls: "avatar-khalid" }, age: "118 days", risk: "high", reason: "Compliance-critical · last audited Q1" },
  { id: "s3", title: "Mobile Release Checklist", type: "Runbook", space: "Ops", owner: { name: "Ali", initial: "A", cls: "avatar-ali" }, age: "104 days", risk: "medium", reason: "Process changed since last review" },
  { id: "s4", title: "Legacy Webhook Migration Notes", type: "ADR", space: "Engineering", owner: { name: "Khalid", initial: "K", cls: "avatar-khalid" }, age: "97 days", risk: "medium", reason: "Superseded by v2 — confirm or archive" },
  { id: "s5", title: "Q3 Pricing Experiment Brief", type: "PRD", space: "Product", owner: { name: "Sara", initial: "S", cls: "avatar-sara" }, age: "92 days", risk: "low", reason: "Experiment concluded · likely archivable" },
];
