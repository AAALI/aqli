import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole, listWorkspaceMembers } from "@/lib/supabase/members";
import { ownerInfo } from "@/lib/supabase/owners";
import AppTopBar from "@/components/layout/AppTopBar";
import { AUDIT_GROUPS, auditVerb, listAuditEvents, type AuditEvent } from "@/lib/audit";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Search = { group?: string; actor?: string; q?: string; before?: string; doc?: string };

/**
 * Settings → Audit log (admins).
 *
 * Every page created, edited, published, archived, restored, deleted; every
 * draft discarded; every review; every change to people, spaces, keys,
 * webhooks and integrations — with who, when, from where, and the name the
 * thing had at the time. Append-only in the database: nobody, admins
 * included, can edit or remove an entry.
 *
 * Server-rendered and driven by the query string, so a filtered view is a
 * link you can send, and the CSV download is the same query.
 */
export default async function SettingsAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Search>;
}) {
  const { workspace: wsSlug } = await params;
  const sp = await searchParams;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const role = await getMyRole(workspace.id);
  if (role !== "admin") notFound();

  const base = `/w/${workspace.slug}`;
  const here = `${base}/settings/audit`;

  const [loaded, members] = await Promise.all([
    listAuditEvents(workspace.id, {
      group: sp.group,
      actorId: sp.actor,
      q: sp.q,
      before: sp.before,
      docId: sp.doc,
      limit: 100,
    })
      .then((r) => ({ ...r, failed: false }))
      .catch((err) => {
        console.error("audit log: could not load", err);
        return { events: [] as AuditEvent[], next: null as string | null, failed: true };
      }),
    listWorkspaceMembers(workspace.id).catch(() => []),
  ]);
  const { events, next } = loaded;
  const people = members
    .map((m) => ({ id: m.user_id, name: ownerInfo(m).name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const link = (patch: Partial<Search>) => {
    const qs = new URLSearchParams();
    const merged: Search = { group: sp.group, actor: sp.actor, q: sp.q, doc: sp.doc, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `${here}?${s}` : here;
  };
  const csvQs = new URLSearchParams();
  for (const k of ["group", "actor", "q", "doc"] as const) if (sp[k]) csvQs.set(k, sp[k]!);

  const days = groupByDay(events);

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Audit log" }]} />
      <div className="wrap">
        <div style={{ maxWidth: 920 }}>
          <h1 className="h1">Audit log</h1>
          <p className="h1s">
            Who did what, when, and from where. Entries can&apos;t be edited or removed — by anyone.
          </p>

          <nav aria-label="Filter by kind" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 24 }}>
            <Chip href={link({ group: undefined, before: undefined })} on={!sp.group}>Everything</Chip>
            {AUDIT_GROUPS.map((g) => (
              <Chip key={g.key} href={link({ group: g.key, before: undefined })} on={sp.group === g.key}>
                {g.label}
              </Chip>
            ))}
          </nav>

          <form method="get" action={here} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {sp.group && <input type="hidden" name="group" value={sp.group} />}
            {sp.doc && <input type="hidden" name="doc" value={sp.doc} />}
            <input
              className="inp"
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search by page title or person"
              style={{ flex: "1 1 240px", height: 34 }}
            />
            <select name="actor" defaultValue={sp.actor ?? ""} className="inp" style={{ flex: "0 1 200px", height: 34 }}>
              <option value="">Anyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary">Filter</button>
            <a className="btn btn-ghost" href={`/api/workspaces/${workspace.id}/audit?${csvQs.toString()}`} download>
              Download CSV
            </a>
          </form>

          {sp.doc && (
            <p className="h1s" style={{ marginTop: 12 }}>
              Showing one page&apos;s history. <Link href={link({ doc: undefined })} style={{ color: "var(--accent)" }}>Show everything</Link>
            </p>
          )}

          {loaded.failed ? (
            <p role="alert" className="h1s" style={{ marginTop: 36, color: "var(--danger-text)" }}>
              The log couldn&apos;t be loaded. Check Settings → Health: the 20260925000000 migration may not be applied.
            </p>
          ) : events.length === 0 ? (
            <p className="h1s" style={{ marginTop: 36 }}>Nothing recorded matches this.</p>
          ) : (
            days.map(([day, rows]) => (
              <section key={day} className="sect" style={{ marginTop: 28 }}>
                <div className="sect-h"><h2>{day}</h2></div>
                {rows.map((e) => (
                  <EventRow key={e.id} e={e} base={base} docHistory={link({ doc: e.doc_id ?? undefined, before: undefined })} />
                ))}
              </section>
            ))
          )}

          {next && (
            <div style={{ marginTop: 24 }}>
              <Link className="btn btn-secondary" href={link({ before: next })}>Older</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`btn btn-sm ${on ? "btn-primary" : "btn-secondary"}`}
    >
      {children}
    </Link>
  );
}

const GONE = new Set(["doc.deleted", "draft.discarded"]);

function EventRow({ e, base, docHistory }: { e: AuditEvent; base: string; docHistory: string }) {
  const who = e.actor_name ?? (e.actor_type === "agent" ? "An agent" : e.actor_type === "system" ? "System" : "Someone");
  const label = e.target_label || (e.target_type === "doc" ? "Untitled" : "");
  const target =
    e.target_type === "doc" && e.doc_id && !GONE.has(e.action) ? (
      <Link href={`${base}/docs/${e.doc_id}`} style={{ color: "var(--text-primary)", fontWeight: 600 }}>
        {label}
      </Link>
    ) : (
      <strong style={{ fontWeight: 600 }}>{label}</strong>
    );
  const details = Object.entries(e.metadata ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  const time = new Date(e.occurred_at);

  return (
    <details style={{ borderBottom: "1px solid var(--border)", padding: "10px 4px" }}>
      <summary style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, cursor: "pointer", listStyle: "none" }}>
        <span style={{ fontSize: 14, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600 }}>{who}</span>
          {e.actor_type !== "human" && (
            <span className="m" style={{ marginLeft: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
              {e.actor_type}
            </span>
          )}{" "}
          <span style={{ color: GONE.has(e.action) ? "var(--danger-text)" : "var(--text-secondary)" }}>{auditVerb(e.action)}</span>{" "}
          {label && target}
        </span>
        <time
          dateTime={e.occurred_at}
          title={time.toISOString()}
          style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}
        >
          {time.toISOString().slice(11, 16)} UTC · {formatRelative(e.occurred_at)}
        </time>
      </summary>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "4px 14px",
          margin: "10px 0 4px",
          fontSize: 12.5,
          color: "var(--text-secondary)",
        }}
      >
        <Dt>Action</Dt><Dd mono>{e.action}</Dd>
        <Dt>When</Dt><Dd mono>{time.toISOString()}</Dd>
        {e.actor_id && (<><Dt>User id</Dt><Dd mono>{e.actor_id}</Dd></>)}
        {e.actor_key_id && (<><Dt>API key</Dt><Dd mono>{e.actor_key_id}</Dd></>)}
        {e.target_id && (<><Dt>{e.target_type} id</Dt><Dd mono>{e.target_id}</Dd></>)}
        {e.ip && (<><Dt>IP</Dt><Dd mono>{e.ip}</Dd></>)}
        {e.user_agent && (<><Dt>Client</Dt><Dd>{e.user_agent}</Dd></>)}
        {details.map(([k, v]) => (
          <span key={k} style={{ display: "contents" }}>
            <Dt>{k.replace(/_/g, " ")}</Dt>
            <Dd mono>{typeof v === "string" ? v : JSON.stringify(v)}</Dd>
          </span>
        ))}
        {e.source === "backfill" && (<><Dt>Source</Dt><Dd>Copied from the page activity feed when the log was switched on</Dd></>)}
        {e.doc_id && (
          <>
            <Dt>History</Dt>
            <Dd><Link href={docHistory} style={{ color: "var(--accent)" }}>Everything on this page</Link></Dd>
          </>
        )}
      </dl>
    </details>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{children}</dt>;
}
function Dd({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <dd style={{ margin: 0, wordBreak: "break-all", fontFamily: mono ? "var(--font-mono)" : undefined }}>{children}</dd>
  );
}

function groupByDay(events: AuditEvent[]): [string, AuditEvent[]][] {
  const out = new Map<string, AuditEvent[]>();
  for (const e of events) {
    const day = new Date(e.occurred_at).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    if (!out.has(day)) out.set(day, []);
    out.get(day)!.push(e);
  }
  return [...out.entries()];
}
