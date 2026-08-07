-- Rollback for 20260806010000_doc_images_storage.sql
--
-- Drops the policies and the bucket row. It deliberately does **not** delete
-- the stored objects: the markdown in `docs.body_md` still references them by
-- URL, and a rollback that emptied the bucket would turn every pasted
-- screenshot into a broken link with no way back.
--
-- Deleting the bucket row fails while objects remain, which is the safe
-- outcome — clear `storage.objects` by hand first if that is really intended.

begin;

drop policy if exists "doc_images_select_members" on storage.objects;
drop policy if exists "doc_images_insert_members" on storage.objects;
drop policy if exists "doc_images_update_members" on storage.objects;
drop policy if exists "doc_images_delete_members" on storage.objects;

delete from storage.buckets where id = 'doc-images';

commit;
