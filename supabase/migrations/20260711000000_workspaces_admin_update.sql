-- The workspaces table only had a SELECT policy ("Members can read
-- workspace"), so the RLS-client PATCH in /api/workspaces/[id] matched zero
-- rows and settings/name/slug changes never persisted. Allow workspace
-- admins to update their own workspace.

create policy "Admins can update workspace" on public.workspaces
  for update
  using (
    id in (
      select workspace_id from public.members
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    id in (
      select workspace_id from public.members
      where user_id = auth.uid() and role = 'admin'
    )
  );
