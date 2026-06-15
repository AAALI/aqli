export type Role = "admin" | "editor" | "viewer";

export type Invitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: Role;
  token: string;
  status: "pending" | "accepted" | "revoked";
  invited_by: string | null;
  created_at: string;
  expires_at: string;
};

export type WorkspaceMember = {
  user_id: string;
  email: string;
  role: Role;
  created_at: string;
};

export type InvitationDetails = {
  workspace_name: string;
  workspace_slug: string;
  role: Role;
  email: string;
  status: "pending" | "accepted" | "revoked";
  expired: boolean;
};
