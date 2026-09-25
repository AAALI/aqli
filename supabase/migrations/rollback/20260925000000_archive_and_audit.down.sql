-- Drops the audit log and archiving. Note what this loses: every audit event
-- recorded since, and the status an archived page would have been restored to.
-- Archived pages are put back to their earlier status first so none are left
-- in a state nothing can undo.
update docs
   set status = coalesce(nullif(status_before_archive, 'archived'), 'approved')
 where status = 'archived' and archived_at is not null;
drop trigger if exists audit_events_append_only on audit_events;
drop function if exists app.audit_events_append_only();
drop table if exists audit_events;
drop function if exists public.set_doc_archived(uuid, boolean);
drop index if exists docs_archived_idx;
alter table docs drop column if exists status_before_archive;
alter table docs drop column if exists archived_by;
alter table docs drop column if exists archived_at;
