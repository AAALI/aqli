alter table public.spaces drop constraint if exists spaces_start_here_len;
alter table public.spaces drop column if exists reading_path;
alter table public.spaces drop column if exists start_here;
drop table if exists public.doc_reads;
drop table if exists public.asked_questions;
