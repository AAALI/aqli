import { listWorkspaceMembers } from "@/lib/supabase/members";

export type OwnerInfo = { name: string; initial: string };

/**
 * Best-effort display name from an email when a member never set a full name —
 * e.g. `ada.lovelace+work@team.com` → `Ada Lovelace`.
 */
function prettifyEmail(email: string): string {
  const local = email.split("@")[0]?.split("+")[0] ?? email;
  const words = local.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return email;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function ownerInfo(member: {
  full_name: string | null;
  email: string;
}): OwnerInfo {
  const name = member.full_name?.trim() || prettifyEmail(member.email);
  return { name, initial: name.charAt(0).toUpperCase() || "?" };
}

/**
 * Map of `user_id → { name, initial }` for everyone in a workspace, so doc
 * lists can show who wrote a doc by name instead of a generic "Member" chip.
 * Non-fatal: returns an empty directory if members can't be read.
 */
export async function getOwnerDirectory(
  workspaceId: string,
): Promise<Record<string, OwnerInfo>> {
  const members = await listWorkspaceMembers(workspaceId).catch(() => []);
  const dir: Record<string, OwnerInfo> = {};
  for (const m of members) dir[m.user_id] = ownerInfo(m);
  return dir;
}
