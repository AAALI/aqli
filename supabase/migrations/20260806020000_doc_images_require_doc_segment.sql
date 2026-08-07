-- Tighten the doc-images write guard.
--
-- `20260806010000_doc_images_storage.sql` guarded writes with
-- `split_part(name, '/', 2) <> ''`, and its own comment said that stopped an
-- object being "parked at the workspace root where the doc it belongs to is
-- unrecoverable". It did not. For `<workspace>/a.png` the second segment is
-- `a.png`, so the guard passed and the object landed with no doc folder —
-- exactly the shape the comment ruled out.
--
-- The path the app writes is `<workspace_id>/<doc_id>/<random>.<ext>`, and
-- `/api/images/[...path]` already refuses to serve anything with fewer than
-- three segments. This makes the write side agree: the third segment is the
-- filename, so requiring it non-empty is what actually requires a doc folder.
--
-- Select and delete are unchanged. They are reached only through a path that
-- passed this check on the way in, and tightening them would strand any object
-- that predates this migration.

drop policy if exists "doc_images_insert_members" on storage.objects;
drop policy if exists "doc_images_update_members" on storage.objects;

create policy "doc_images_insert_members"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'doc-images'
    and split_part(storage.objects.name, '/', 3) <> ''
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

create policy "doc_images_update_members"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'doc-images'
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
  with check (
    bucket_id = 'doc-images'
    and split_part(storage.objects.name, '/', 3) <> ''
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
