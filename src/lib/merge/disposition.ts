/**
 * Disposition — does this write land, or does it queue? (spec §3.1)
 *
 * This is the TypeScript twin of `app.decide_disposition` in
 * `supabase/migrations/20260805030000_merge_engine.sql`. The database copy is
 * authoritative: it runs inside the same transaction as the merge, so the
 * decision and the write cannot disagree. This copy exists so the API can
 * tell a caller what will happen (and shape its response) without a round
 * trip, and so the rules are testable without a database.
 *
 * `lib/merge/__tests__/disposition.test.ts` asserts the full truth table.
 * `supabase/tests/merge_engine.sql` asserts the same table against Postgres.
 * If you change one, change the other.
 */

export type ReviewPolicy = "open" | "review_agents" | "review_all";
export type ActorType = "human" | "agent" | "system";
export type AgentScope = "read" | "propose" | "write";
export type DocClass = "canon" | "record";

export type Disposition = "merge" | "queue";

export function decideDisposition(input: {
  spacePolicy: ReviewPolicy;
  actorType: ActorType;
  scopes: AgentScope[];
  docClass: DocClass;
}): Disposition {
  // Records are history, not claims. They are never subject to review — a
  // queue of "did this PR really merge?" approvals is nonsense, and the review
  // that mattered happened in GitHub.
  if (input.docClass === "record") return "merge";

  switch (input.spacePolicy) {
    case "open":
      return "merge";
    // `review_all` queues humans too. That is the point of a compliance
    // space, and it is what lets a regulated team adopt this at all.
    case "review_all":
      return "queue";
    case "review_agents":
      if (input.actorType === "human") return "merge";
      return input.scopes.includes("write") ? "merge" : "queue";
  }
}
