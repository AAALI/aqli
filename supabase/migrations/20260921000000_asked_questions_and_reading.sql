-- What people ask, what they read, and what a space recommends (v3 §5.7, §5.8, §5.11).
--
-- Three v3 surfaces answer questions the database could not:
--
--   * Home's "Asked this week · no doc answers it" and Search's "Nobody has
--     written this down" need to know what people asked and whether a doc
--     answered it. That is `asked_questions`.
--   * A space's reading path says "~20 minutes · 38 people have finished it",
--     which needs to know who read what. That is `doc_reads`.
--   * A space's "Start here" cards and its reading path are curated by the
--     owner, not inferred. Those are two ordered id arrays on `spaces`.
--
-- The unanswered-question list is the whole of "content strategy" in v3, so
-- it is recorded as data rather than approximated from search logs later.

-- --- asked_questions --------------------------------------------------------

create table if not exists public.asked_questions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asked_by     uuid not null default auth.uid(),
  question     text not null,
  -- Lowercased, punctuation and extra space removed: what "the same question"
  -- means when counting how many times something was asked.
  normalized   text not null,
  -- The doc that answered it, if one did. Null is the signal: nobody has
  -- written this down.
  answered_by  uuid references public.docs(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint asked_questions_question_check check (length(btrim(question)) between 1 and 500)
);

comment on table public.asked_questions is
  'Questions asked through ⌘K and Search. Unanswered ones (answered_by is null) feed Home and Search as gaps.';

create index if not exists asked_questions_workspace_created_idx
  on public.asked_questions (workspace_id, created_at desc);
create index if not exists asked_questions_gap_idx
  on public.asked_questions (workspace_id, normalized)
  where answered_by is null;

alter table public.asked_questions enable row level security;
grant select, insert on table public.asked_questions to authenticated;

-- Anyone in the workspace can see what the workspace asked: gaps are shared
-- work. Only the asker can record their own question.
drop policy if exists asked_questions_select on public.asked_questions;
create policy asked_questions_select on public.asked_questions
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

drop policy if exists asked_questions_insert on public.asked_questions;
create policy asked_questions_insert on public.asked_questions
  for insert to authenticated
  with check (
    (select app.is_member(workspace_id))
    and asked_by = (select auth.uid())
    and (answered_by is null or (select app.doc_in_workspace(answered_by, workspace_id)))
  );

-- --- doc_reads --------------------------------------------------------------

-- One row per person per doc — the first time they read it. Enough to say
-- whether someone finished a reading path; deliberately not a view log.
create table if not exists public.doc_reads (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  doc_id       uuid not null references public.docs(id) on delete cascade,
  user_id      uuid not null default auth.uid(),
  read_at      timestamptz not null default now(),
  primary key (doc_id, user_id)
);

create index if not exists doc_reads_workspace_idx on public.doc_reads (workspace_id, user_id);

alter table public.doc_reads enable row level security;
grant select, insert on table public.doc_reads to authenticated;

drop policy if exists doc_reads_select on public.doc_reads;
create policy doc_reads_select on public.doc_reads
  for select to authenticated
  using ( (select app.is_member(workspace_id)) );

drop policy if exists doc_reads_insert on public.doc_reads;
create policy doc_reads_insert on public.doc_reads
  for insert to authenticated
  with check (
    (select app.is_member(workspace_id))
    and user_id = (select auth.uid())
    and (select app.doc_in_workspace(doc_id, workspace_id))
  );

-- --- curated shelves on spaces ----------------------------------------------

alter table public.spaces
  add column if not exists start_here   uuid[] not null default '{}'::uuid[],
  add column if not exists reading_path uuid[] not null default '{}'::uuid[];

comment on column public.spaces.start_here is
  'Up to three doc ids shown as Start here cards on the space page, in order. Curated by the space owner.';
comment on column public.spaces.reading_path is
  'Doc ids a newcomer should read, in order. Completion is counted from doc_reads.';

alter table public.spaces
  drop constraint if exists spaces_start_here_len;
alter table public.spaces
  add constraint spaces_start_here_len check (coalesce(array_length(start_here, 1), 0) <= 3);
