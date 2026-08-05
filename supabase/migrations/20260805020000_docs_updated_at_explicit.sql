-- Let a writer set `updated_at` deliberately.
--
-- `docs_maintain_derived` sets `updated_at := now()` on every write, with no
-- way to opt out. The document list is ordered by `updated_at desc`, so any
-- bulk write — the markdown backfill, the revisions backfill, an importer —
-- restamps every row it touches and silently reshuffles every list in the app.
--
-- The step-1 migration worked around this by disabling the trigger around its
-- backfill, which is only available to SQL running as the table owner. The
-- markdown backfill runs over PostgREST and cannot disable a trigger, so it
-- instead passed `updated_at` through in the same update and assumed that would
-- be honoured. It is not: the trigger fires `before update` and overwrites it.
-- Measured against production before this migration, an update passing the
-- row's own `updated_at` still came back stamped with `now()`.
--
-- So: bump `updated_at` unless the caller asked for a specific value.
--
-- Note the limit of what a `before` trigger can know. It sees the new row and
-- the old row, not which columns the statement mentioned, so "the caller passed
-- `updated_at` and it happens to equal the stored value" is indistinguishable
-- from "the caller said nothing". Only a *different* value can be recognised as
-- deliberate. A writer restoring a timestamp therefore does it in two steps —
-- write the content, then write the timestamp back, which by then differs from
-- the `now()` the first step stamped. `scripts/backfill-markdown.ts` does
-- exactly this.
--
-- Insert behaviour is deliberately unchanged.

create or replace function docs_maintain_derived()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.body_text := app.md_to_text(new.body_md);
  new.headings  := app.md_headings(new.body_md);

  -- On update, an `updated_at` that differs from the stored one was set by the
  -- caller on purpose; anything else gets the usual bump.
  if not (tg_op = 'UPDATE' and new.updated_at is distinct from old.updated_at) then
    new.updated_at := now();
  end if;

  return new;
end;
$$;
