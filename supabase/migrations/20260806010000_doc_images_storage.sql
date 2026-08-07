-- Doc images (roadmap Phase 2 §1).
--
-- A private Storage bucket holding images pasted or dropped into the editor,
-- keyed by workspace so RLS can decide access from the object path alone.
--
-- Deploy note: this migration is independent of the `body_md_backfill` gate in
-- `20260805040000_body_md_canonical.sql`. It touches only `storage`, reads
-- `public.members`, and neither reads nor writes `docs`, so it can be applied
-- without waiting for the backfill.
--
-- Path layout, which the policies below depend on:
--
--   <workspace_id>/<doc_id>/<random>.<ext>
--
-- The first segment is the workspace. Every policy compares it as *text*
-- against `members.workspace_id::text` rather than casting the segment to
-- `uuid`: a cast would raise on a malformed path, and an authenticated caller
-- controls the path they attempt to write.

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

-- Private. The app serves these through `/api/images/*`, which re-checks
-- membership on every request, so the URL stored in `body_md` is both stable
-- and access-controlled. A signed URL could not be stored: it expires, and
-- markdown is canonical — the link would rot inside the document.
--
-- SVG is deliberately absent from the allowlist. It is script-bearing, and
-- these files are served from the app's own origin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'doc-images',
  'doc-images',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists "doc_images_select_members" on storage.objects;
drop policy if exists "doc_images_insert_members" on storage.objects;
drop policy if exists "doc_images_update_members" on storage.objects;
drop policy if exists "doc_images_delete_members" on storage.objects;

create policy "doc_images_select_members"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'doc-images'
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

-- Writes additionally require a second path segment, so an object cannot be
-- parked at the workspace root where the doc it belongs to is unrecoverable.
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

create policy "doc_images_delete_members"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'doc-images'
    and exists (
      select 1
      from public.members m
      where m.user_id = auth.uid()
        and m.workspace_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
