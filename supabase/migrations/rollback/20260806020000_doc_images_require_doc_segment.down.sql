-- Rollback for 20260806020000_doc_images_require_doc_segment.sql
--
-- Restores the write guard exactly as 20260806010000 left it. Note what that
-- means: the weaker check is the defect this migration fixed, so running this
-- re-admits `<workspace>/file.png` objects with no doc folder. It exists to
-- return the database to a known prior state, not because that state is good.

begin;

drop policy if exists "doc_images_insert_members" on storage.objects;
drop policy if exists "doc_images_update_members" on storage.objects;

create policy "doc_images_insert_members"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'doc-images'
    and split_part(storage.objects.name, '/', 2) <> ''
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
    and split_part(storage.objects.name, '/', 2) <> ''
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

commit;
