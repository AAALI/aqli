import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { getDocs } from "@/lib/supabase/docs";
import { getPendingReviewDocs } from "@/lib/supabase/review";
import { getStaleDocs, daysSinceReview } from "@/lib/supabase/stale";
import { getWorkspaceActivity, type FeedActivity } from "@/lib/supabase/activity";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { greeting, todayLong, withinHours, dayBucket } from "@/lib/home";
import AppTopBar from "@/components/layout/AppTopBar";
import { AgentChip } from "@/components/aqli/badges";
import { typeLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import {
  IconEdit,
  IconBook,
  IconArrowUpRight,
  IconRobot,
  IconWarn,
  IconGitMerge,
  IconCheckCircle,
  IconSparkle,
  IconPlus,
} from "@/components/aqli/icons";
import type { DocWithSpace } from "@/types/doc";

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [recentDocs, pendingReview, staleDocs, activity, spaces] = await Promise.all([
    getDocs(workspace.id, { limit: 16 }),
    getPendingReviewDocs(workspace.id),
    getStaleDocs(workspace.id),
    getWorkspaceActivity(workspace.id, 24),
    getSpaces(workspace.id),
  ]);

  const base = `/w/${workspace.slug}`;
  const myId = user?.id ?? null;
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";
  const firstName = fullName.split(" ")[0];
  const firstSpace = spaces[0];
  const newDocHref = firstSpace ? `${base}/s/${firstSpace.slug}/new` : base;

  // Brand-new workspace — keep the clean-slate welcome.
  if (recentDocs.length === 0) {
    return (
      <>
        <AppTopBar base={base} crumbs={[{ label: "Home" }]} />
        <div className="content">
          <EmptyWorkspace firstSpaceHref={firstSpace ? `${base}/s/${firstSpace.slug}` : base} />
        </div>
      </>
    );
  }

  // ── Pick up where you left off ──────────────────────────────────────
  const drafts = recentDocs.filter((d) => d.status === "draft");
  const myDraft = drafts.find((d) => d.owner_id === myId) ?? drafts[0] ?? null;
  const reading = recentDocs.find((d) => d.status === "approved" && d.id !== myDraft?.id) ?? null;
  const recent = recentDocs.find((d) => d.id !== myDraft?.id && d.id !== reading?.id) ?? null;

  // ── Needs your attention ────────────────────────────────────────────
  const agentAwaiting = pendingReview.filter((d) => d.author_type === "agent");
  const humanAwaiting = pendingReview.filter((d) => d.author_type !== "agent");
  const attention = [
    ...agentAwaiting.map((doc) => ({ kind: "review" as const, doc })),
    ...humanAwaiting.map((doc) => ({ kind: "review" as const, doc })),
    ...staleDocs.map((doc) => ({ kind: "stale" as const, doc })),
  ].slice(0, 5);

  // ── Headline ────────────────────────────────────────────────────────
  const autoPublished = recentDocs.filter(
    (d) => d.frontmatter?.source_pr_url && withinHours(d.updated_at, 24),
  ).length;
  const sub = buildHeadline(autoPublished, agentAwaiting.length, staleDocs.length);

  // ── What's new feed ─────────────────────────────────────────────────
  const feedGroups = groupFeed(activity);

  return (
    <>
      <AppTopBar
        base={base}
        crumbs={[{ label: "Home" }]}
        primary={firstSpace ? { label: "New Doc", href: newDocHref } : null}
      />
      <div className="content" style={{ overflowY: "auto", padding: "32px 56px 64px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* Hero */}
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 11.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {todayLong()}
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: 42,
                fontWeight: 400,
                letterSpacing: "-0.018em",
                lineHeight: 1.05,
              }}
            >
              {greeting(firstName)}
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 16,
                lineHeight: 1.55,
                color: "var(--text-secondary)",
                maxWidth: 640,
              }}
            >
              {sub}
            </p>
          </div>

          {/* Pick up where you left off */}
          <PickupRow base={base} myDraft={myDraft} reading={reading} recent={recent} />

          {/* Needs your attention */}
          <section style={{ marginBottom: 44 }}>
            <SectionHead
              eyebrow="Needs your attention"
              title={attentionTitle(attention.length)}
              right={
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    background: "var(--approved-bg)",
                    color: "var(--approved-text)",
                    border: "1px solid var(--approved-border)",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  <IconGitMerge size={11} /> PR merges skip review
                </span>
              }
            />
            {attention.length === 0 ? (
              <EmptyCard text="You're all caught up — nothing needs review or a refresh." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {attention.map((a) => (
                  <AttentionRow key={a.doc.id} base={base} kind={a.kind} doc={a.doc} />
                ))}
              </div>
            )}
          </section>

          {/* What's new */}
          <section>
            <SectionHead eyebrow="What's new" title="In your spaces" />
            {feedGroups.length === 0 ? (
              <EmptyCard text="No recent activity yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
                {feedGroups.map((g) => (
                  <div key={g.when}>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        marginBottom: 6,
                      }}
                    >
                      {g.when}
                    </div>
                    {g.events.map((e) => (
                      <FeedRow key={e.id} base={base} e={e} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// ── Headline / titles ─────────────────────────────────────────────────

function buildHeadline(autoPublished: number, agentDrafts: number, stale: number): string {
  const parts: string[] = [];
  if (autoPublished > 0)
    parts.push(
      `${autoPublished} PR merge${autoPublished === 1 ? "" : "s"} auto-published recently.`,
    );
  if (agentDrafts > 0)
    parts.push(
      `${agentDrafts} agent draft${agentDrafts === 1 ? "" : "s"} need${agentDrafts === 1 ? "s" : ""} your review.`,
    );
  if (parts.length === 0 && stale > 0)
    parts.push(`${stale} doc${stale === 1 ? "" : "s"} could use a freshness check.`);
  if (parts.length === 0) return "Everything's current — a good day to write something down.";
  return parts.join(" ");
}

function attentionTitle(n: number): string {
  if (n === 0) return "Nothing pending";
  return `${n} thing${n === 1 ? "" : "s"} only you can move forward`;
}

// ── Pick-up row ───────────────────────────────────────────────────────

function PickupRow({
  base,
  myDraft,
  reading,
  recent,
}: {
  base: string;
  myDraft: DocWithSpace | null;
  reading: DocWithSpace | null;
  recent: DocWithSpace | null;
}) {
  const cards: { label: string; icon: React.ReactNode; doc: DocWithSpace }[] = [];
  if (myDraft) cards.push({ label: "Continue draft", icon: <IconEdit size={13} />, doc: myDraft });
  if (reading) cards.push({ label: "Pick up reading", icon: <IconBook size={13} />, doc: reading });
  if (recent) cards.push({ label: "Recently updated", icon: <IconSparkle size={13} />, doc: recent });
  if (cards.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cards.length}, 1fr)`,
        gap: 12,
        marginBottom: 44,
      }}
    >
      {cards.map((c) => (
        <Link
          key={c.doc.id + c.label}
          href={`${base}/docs/${c.doc.id}`}
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "16px 18px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            minWidth: 0,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            <span style={{ color: "var(--accent)", display: "inline-flex" }}>{c.icon}</span>
            {c.label}
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              lineHeight: 1.25,
              letterSpacing: "-0.005em",
              color: "var(--text-primary)",
              marginBottom: 8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.doc.title}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {typeLabel(c.doc.type)}
            {c.doc.space ? ` · ${c.doc.space.name}` : ""} · {formatRelative(c.doc.updated_at)}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Attention row ─────────────────────────────────────────────────────

function AttentionRow({
  base,
  kind,
  doc,
}: {
  base: string;
  kind: "review" | "stale";
  doc: DocWithSpace;
}) {
  const tone =
    kind === "review" && doc.author_type === "agent"
      ? { border: "var(--agent-border)", bg: "var(--agent-tint)", icon: <IconRobot size={14} /> }
      : kind === "stale"
        ? { border: "var(--stale-border)", bg: "var(--stale-bg)", icon: <IconWarn size={14} /> }
        : { border: "var(--border-strong)", bg: "var(--bg-card)", icon: <IconCheckCircle size={14} sw={1.8} /> };

  const days = daysSinceReview(doc);
  const meta =
    kind === "review"
      ? `${typeLabel(doc.type)}${doc.space ? ` · ${doc.space.name}` : ""} · awaiting review · ${formatRelative(doc.updated_at)}`
      : `${typeLabel(doc.type)}${doc.space ? ` · ${doc.space.name}` : ""} · ${days === null ? "never verified" : `last verified ${days}d ago`}`;
  const cta = kind === "review" ? "Review" : "Open doc";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr auto",
        gap: 16,
        padding: "14px 18px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${tone.border}`,
        borderRadius: 8,
        alignItems: "center",
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: tone.bg,
          color: tone.border,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 32px",
        }}
      >
        {tone.icon}
      </span>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>
            {doc.title}
          </span>
          {kind === "review" && doc.author_type === "agent" && (
            <AgentChip label={doc.agent_id ?? "Agent"} />
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{meta}</div>
      </div>

      <Link
        href={`${base}/docs/${doc.id}`}
        className="btn btn-primary"
        style={{ height: 28, fontSize: 12.5, padding: "0 12px" }}
      >
        {cta}
      </Link>
    </div>
  );
}

// ── Feed ──────────────────────────────────────────────────────────────

type FeedGroup = { when: string; events: FeedActivity[] };

function groupFeed(activity: FeedActivity[]): FeedGroup[] {
  const order = ["Today", "Yesterday", "Earlier"] as const;
  const buckets: Record<string, FeedActivity[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const a of activity) buckets[dayBucket(a.created_at)].push(a);
  return order.map((when) => ({ when, events: buckets[when] })).filter((g) => g.events.length > 0);
}

const VERB: Record<string, string> = {
  created: "drafted",
  approved: "approved",
  status_changed: "updated",
  review_requested: "requested review for",
  changes_requested: "requested changes on",
  rejected: "rejected",
};

function FeedRow({ base, e }: { base: string; e: FeedActivity }) {
  const autoApproved =
    Boolean(e.metadata?.auto_approved) ||
    (e.action === "approved" && Boolean(e.doc?.frontmatter?.source_pr_url));
  const isAgent = e.actor_type === "agent";
  const who = e.actor_name ?? (isAgent ? "An agent" : "Someone");
  let verb = VERB[e.action] ?? e.action;
  if (autoApproved) verb = "merged PR → auto-published";
  else if (e.action === "created" && isAgent) verb = "drafted (awaiting review)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "26px 1fr auto",
        gap: 10,
        padding: "8px 0",
        alignItems: "start",
      }}
    >
      <FeedIcon autoApproved={autoApproved} isAgent={isAgent} initial={(who[0] ?? "?").toUpperCase()} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.45 }}>
          <span style={{ fontWeight: 500 }}>{who}</span>
          <span style={{ color: "var(--text-secondary)" }}> {verb} </span>
          {e.doc ? (
            <Link
              href={`${base}/docs/${e.doc.id}`}
              style={{ fontWeight: 500, color: "var(--text-primary)", textDecoration: "none" }}
            >
              {e.doc.title}
            </Link>
          ) : (
            <span style={{ fontWeight: 500 }}>a doc</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {autoApproved && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 18,
                padding: "0 6px",
                borderRadius: 5,
                fontSize: 10.5,
                fontWeight: 500,
                background: "var(--approved-bg)",
                color: "var(--approved-text)",
                border: "1px solid var(--approved-border)",
              }}
            >
              <IconGitMerge size={10} /> Auto-approved
            </span>
          )}
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {e.doc?.space ? `${e.doc.space.name} · ` : ""}
            {formatRelative(e.created_at)}
          </span>
        </div>
      </div>
      {e.doc && (
        <span style={{ color: "var(--text-muted)", marginTop: 4 }}>
          <IconArrowUpRight size={13} />
        </span>
      )}
    </div>
  );
}

function FeedIcon({
  autoApproved,
  isAgent,
  initial,
}: {
  autoApproved: boolean;
  isAgent: boolean;
  initial: string;
}) {
  if (autoApproved) {
    return (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "var(--approved-bg)",
          border: "1px solid var(--approved-border)",
          color: "var(--approved-text)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconGitMerge size={11} />
      </span>
    );
  }
  if (isAgent) {
    return (
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "var(--agent-tint)",
          border: "1px solid var(--agent-border)",
          color: "var(--agent-icon)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconRobot size={11} />
      </span>
    );
  }
  return <span className="avatar avatar-sm avatar-ali">{initial}</span>;
}

// ── Shared bits ───────────────────────────────────────────────────────

function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 16,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          {eyebrow}
        </div>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "20px 18px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 13.5,
        color: "var(--text-muted)",
      }}
    >
      {text}
    </div>
  );
}

function EmptyWorkspace({ firstSpaceHref }: { firstSpaceHref: string }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <h1
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 36,
            letterSpacing: "-0.02em",
          }}
        >
          A clean slate.
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 15, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          This workspace doesn&apos;t have any docs yet. Start with a PRD, an ADR, or the on-call
          thing nobody wrote down — your agents will read it for context.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href={`${firstSpaceHref}/new`} className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>
            <IconPlus size={14} /> Write your first doc
          </Link>
          <Link href={firstSpaceHref} className="btn btn-secondary" style={{ height: 38, padding: "0 16px" }}>
            Browse a space <IconArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
