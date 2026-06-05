export type Workspace = {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
};

export type Member = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "admin" | "editor" | "viewer";
  created_at: string;
};
