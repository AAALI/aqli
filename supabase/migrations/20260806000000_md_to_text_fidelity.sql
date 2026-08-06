-- Stop `app.md_to_text` mangling identifiers, and teach it about tables.
--
-- `body_text` is what the search snippet shows the reader and, through
-- `search_vector`, what full-text search matches on. Two rules were losing
-- information that people actually search for:
--
--   1. `[*_~]{1,3}` stripped every underscore in the document, not just
--      emphasis delimiters. `manual_review` was indexed and displayed as
--      `manualreview`, so searching the identifier found nothing and the
--      snippet showed a word that appears nowhere in the source. Markdown
--      itself does not treat an intraword underscore as emphasis (CommonMark
--      requires a word boundary), so the fix is to apply the same rule here:
--      strip a run of underscores only where it could open or close emphasis.
--
--   2. GFM tables were left with their pipes and their delimiter row, so a
--      snippet read `| Postgres 17 | | Queue | SQS |` — punctuation noise, and
--      `---|---` tokens in the index. Cell separators become spaces (not
--      nothing, or the last word of one cell glues to the first of the next)
--      and the delimiter row goes entirely.
--
-- Asterisk and tilde keep the old blunt treatment: neither is common in prose,
-- and neither has the intraword meaning that underscore does in code.

create or replace function app.md_to_text(md text)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog', 'pg_temp'
as $function$
declare
  t text := coalesce(md, '');
begin
  t := regexp_replace(t, '```.*?```', ' ', 'g');
  t := regexp_replace(t, '~~~.*?~~~', ' ', 'g');
  t := regexp_replace(t, '`([^`]*)`', '\1', 'g');
  t := regexp_replace(t, '!\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  t := regexp_replace(t, '\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  t := regexp_replace(t, '^[ \t]*#{1,6}[ \t]+', '', 'gn');
  t := regexp_replace(t, '^[ \t]*>[ \t]?', '', 'gn');
  t := regexp_replace(t, '^[ \t]*([-*+]|[0-9]+\.)[ \t]+', '', 'gn');
  t := regexp_replace(t, '^[ \t]*(-[ \t]*){3,}$', ' ', 'gn');

  -- GFM tables: drop the delimiter row, then turn separators into spaces.
  t := regexp_replace(
         t,
         '^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$',
         ' ',
         'gn'
       );
  t := replace(t, '|', ' ');

  t := regexp_replace(t, '\*{1,3}', '', 'g');
  t := regexp_replace(t, '~{1,2}', '', 'g');
  -- Underscore emphasis only at a word boundary, so snake_case survives.
  t := regexp_replace(t, '(^|[^[:alnum:]_])_{1,3}([^[:space:]_])', '\1\2', 'gn');
  t := regexp_replace(t, '([^[:space:]_])_{1,3}([^[:alnum:]_]|$)', '\1\2', 'gn');

  t := regexp_replace(t, '<[^>]*>', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  return btrim(t);
end;
$function$;

-- Re-derive what the old rules got wrong. The trigger is disabled around the
-- backfill because it would otherwise stamp `updated_at = now()` on every row
-- and reshuffle every list in the app that orders by it — the same hazard
-- 20260805020000 documents. `search_vector` is generated from `body_text` and
-- `headings`, so it follows automatically.
alter table docs disable trigger docs_maintain_derived;

update docs
   set body_text = app.md_to_text(body_md),
       headings  = app.md_headings(body_md)
 where body_md is not null
   and (body_text is distinct from app.md_to_text(body_md)
        or headings is distinct from app.md_headings(body_md));

alter table docs enable trigger docs_maintain_derived;
