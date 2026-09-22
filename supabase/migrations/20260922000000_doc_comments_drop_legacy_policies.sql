-- Drop the hand-made doc_comments policies that predate 20260808000000.
--
-- Production carried two policies created by hand before that migration:
-- "Members can read comments in their workspace" and "Members can create
-- comments". 20260808000000 added its own and dropped only its own names, and
-- Postgres ORs permissive policies together — so the old insert policy, which
-- checked nothing but membership, kept letting any member insert a comment of
-- any type under any author. That is a forged review trail: an "approval" or a
-- "rejection" nobody made.
--
-- The replacements (doc_comments_read / _insert / _delete) cover the same read
-- access and the intended write rules. Safe on a fresh install, where these
-- names never existed.

drop policy if exists "Members can read comments in their workspace" on public.doc_comments;
drop policy if exists "Members can create comments" on public.doc_comments;
