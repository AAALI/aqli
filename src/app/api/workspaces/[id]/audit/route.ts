import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { csvCell, listAuditEvents, type AuditEvent } from "@/lib/audit";

/**
 * The audit log, for admins.
 *
 *   GET ?format=json  → one page, `{ events, next }`; pass `before=<next>` for the one after.
 *   GET (default)     → CSV of everything the filters match, newest first, for
 *                       handing to whoever asked for it.
 *
 * Same filters as the page: group, actor, q, doc.
 */
const CSV_CAP = 50_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getMyRole(id)) !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const filters = {
    group: sp.get("group"),
    actorId: sp.get("actor"),
    q: sp.get("q"),
    docId: sp.get("doc"),
  };

  if (sp.get("format") === "json") {
    const page = await listAuditEvents(id, {
      ...filters,
      before: sp.get("before"),
      limit: Number(sp.get("limit")) || 100,
    });
    return NextResponse.json(page);
  }

  const all: AuditEvent[] = [];
  let before: string | null = null;
  do {
    const page: { events: AuditEvent[]; next: string | null } = await listAuditEvents(id, {
      ...filters,
      before,
      limit: 500,
    });
    all.push(...page.events);
    before = page.next;
  } while (before && all.length < CSV_CAP);

  const header = [
    "occurred_at",
    "actor_type",
    "actor_name",
    "actor_id",
    "actor_key_id",
    "action",
    "target_type",
    "target_id",
    "target_label",
    "doc_id",
    "space_id",
    "ip",
    "user_agent",
    "metadata",
    "source",
  ] as const;
  const lines = [header.join(",")];
  for (const e of all) {
    lines.push(
      header
        .map((k) => csvCell(k === "metadata" ? JSON.stringify(e.metadata ?? {}) : (e[k] as string | null)))
        .join(","),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-log-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
