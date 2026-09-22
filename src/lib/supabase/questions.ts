import { createServerSupabaseClient } from "./server";

/**
 * What people asked, and whether anything answered it (v3 §5.7, §5.11).
 *
 * The unanswered list is the whole of "content strategy" in v3: Home's
 * "Asked this week · no doc answers it" and Search's "Nobody has written this
 * down" both read from here. Recording is best-effort — a question that fails
 * to log must never fail the answer the person was waiting for.
 */

/** What "the same question" means when counting how often it was asked. */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Did the answer actually answer? Retrieval can return passages that do not
 * contain the answer, and the model is told to say so when that happens — so
 * the model's own admission counts as unanswered.
 */
export function answerAdmitsGap(answer: string): boolean {
  return /\b(does not contain|doesn't contain|not enough information|no (relevant )?information|cannot (be )?answer|isn't covered|is not covered|nobody has written)\b/i.test(
    answer,
  );
}

export async function recordQuestion(
  workspaceId: string,
  question: string,
  answeredBy: string | null,
): Promise<void> {
  const text = question.trim().slice(0, 500);
  const normalized = normalizeQuestion(text);
  if (!normalized) return;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("asked_questions").insert({
      workspace_id: workspaceId,
      asked_by: user.id,
      question: text,
      normalized,
      answered_by: answeredBy,
    });
  } catch (err) {
    console.error("recordQuestion failed:", err);
  }
}

export type Gap = {
  /** The most recent phrasing, as the person typed it. */
  question: string;
  normalized: string;
  /** Times asked in the window. */
  count: number;
  /** Distinct people who asked it. */
  askers: number;
  lastAsked: string;
};

/**
 * Questions nobody has answered, most-asked first.
 *
 * A question that *was* answered at any point in the window is not a gap, even
 * if it went unanswered earlier — someone has written it down since.
 */
export async function getGaps(
  workspaceId: string,
  opts: { sinceDays?: number; limit?: number; match?: string } = {},
): Promise<Gap[]> {
  const { sinceDays = 7, limit = 5, match } = opts;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const supabase = await createServerSupabaseClient();
    let q = supabase
      .from("asked_questions")
      .select("question, normalized, asked_by, answered_by, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (match) {
      const words = normalizeQuestion(match).split(" ").filter((w) => w.length > 2);
      if (words.length) q = q.or(words.map((w) => `normalized.ilike.%${w}%`).join(","));
    }
    const { data, error } = await q;
    if (error) throw error;
    return groupGaps((data ?? []) as GapRow[]).slice(0, limit);
  } catch (err) {
    // The table may not exist yet on an installation that has not applied
    // 20260921000000. Gaps are an addition to Home, never a reason for it to
    // fail — so an empty list, not an error.
    console.error("getGaps failed:", err);
    return [];
  }
}

type GapRow = {
  question: string;
  normalized: string;
  asked_by: string;
  answered_by: string | null;
  created_at: string;
};

/** Exported for tests: the grouping is the part with rules in it. */
export function groupGaps(rows: GapRow[]): Gap[] {
  const answered = new Set(rows.filter((r) => r.answered_by).map((r) => r.normalized));
  const groups = new Map<string, { rows: GapRow[]; askers: Set<string> }>();
  for (const r of rows) {
    if (r.answered_by || answered.has(r.normalized)) continue;
    const g = groups.get(r.normalized) ?? { rows: [], askers: new Set() };
    g.rows.push(r);
    g.askers.add(r.asked_by);
    groups.set(r.normalized, g);
  }
  return [...groups.entries()]
    .map(([normalized, g]) => {
      const latest = g.rows.reduce((a, b) => (a.created_at > b.created_at ? a : b));
      return {
        question: latest.question,
        normalized,
        count: g.rows.length,
        askers: g.askers.size,
        lastAsked: latest.created_at,
      };
    })
    .sort((a, b) => b.count - a.count || (a.lastAsked < b.lastAsked ? 1 : -1));
}

/** Record that the viewer read a doc. Once per person per doc; best-effort. */
export async function recordRead(workspaceId: string, docId: string): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("doc_reads")
      .upsert(
        { workspace_id: workspaceId, doc_id: docId, user_id: user.id },
        { onConflict: "doc_id,user_id", ignoreDuplicates: true },
      );
  } catch (err) {
    console.error("recordRead failed:", err);
  }
}

/** How many people have read every doc on a path, and what the viewer has read. */
export async function readingPathProgress(
  workspaceId: string,
  path: string[],
): Promise<{ finished: number; mine: Set<string> }> {
  if (path.length === 0) return { finished: 0, mine: new Set() };
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("doc_reads")
      .select("doc_id, user_id")
      .eq("workspace_id", workspaceId)
      .in("doc_id", path);
    if (error) throw error;
    const byUser = new Map<string, Set<string>>();
    for (const r of (data ?? []) as { doc_id: string; user_id: string }[]) {
      const s = byUser.get(r.user_id) ?? new Set<string>();
      s.add(r.doc_id);
      byUser.set(r.user_id, s);
    }
    const finished = [...byUser.values()].filter((s) => path.every((id) => s.has(id))).length;
    return { finished, mine: (user && byUser.get(user.id)) || new Set() };
  } catch (err) {
    console.error("readingPathProgress failed:", err);
    return { finished: 0, mine: new Set() };
  }
}
