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
  created_at: string;
};
