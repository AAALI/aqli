-- Restores the pre-hardening grants and drops draft privacy. Note what this
-- reopens: signed-out callers could record migration gates and read the
-- preflight report, and every member could read every draft.
drop policy if exists doc_comments_draft_privacy on public.doc_comments;
drop policy if exists docs_draft_privacy on public.docs;
drop function if exists app.can_see_draft(uuid, uuid);
drop function if exists app.draft_shared_with(uuid, uuid);
grant execute on function public.record_migration_gate(text, jsonb) to public;
grant execute on function public.blocked_space_ids(uuid, uuid) to public;
grant execute on function public.accept_invitation(text) to public;
grant execute on function public.create_workspace_for_user(text, text) to public;
grant execute on function public.list_workspace_members(uuid) to public;
grant execute on function public.is_space_reviewer(uuid, uuid) to public;
grant execute on function public.space_names_reviewers(uuid) to public;
grant execute on function public.preflight_report(text[]) to public;
