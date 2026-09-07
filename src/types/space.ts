import type { ReviewPolicy } from "@/lib/merge/disposition";

export type Space = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  icon: string;
  /**
   * Who has to approve a write into this space (spec §2.2). The rules live in
   * `lib/merge/disposition.ts` and, authoritatively, in
   * `app.decide_disposition`. Defaults to `review_agents`.
   */
  review_policy: ReviewPolicy;
  /**
   * Who may read it (docs/adoption.md F-4). `open` is every workspace member;
   * `private` is its `space_members` only — in the UI, in search, in RAG and on
   * the agent path, which inherits the key owner's membership.
   */
  visibility: "open" | "private";
  created_at: string;
};

/** A member of a space. `reviewer` may also approve proposals there. */
export type SpaceMember = {
  id: string;
  space_id: string;
  user_id: string;
  role: "member" | "reviewer";
  created_at: string;
};
